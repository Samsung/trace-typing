/* 
 * Copyright 2015 Samsung Research America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
///<reference path="../types.d.ts"/>
///<reference path="../../typings/node/node.d.ts"/>

import util = require('util');
import AST = require('../TraceLanguageAST');
import TypeImpls = require('./TypeImpls');
import Misc = require('../Misc');
import Impls = require('../trace-replaying/HeapHistoryImpls');
import TypeLattices = require('./TypeLattices');
import SJS = require('../SJS');

var None = Misc.None;
var Some = Misc.Some;

function getPrototype(instance:Instance):Value {
    return instance.shapes[0]/* prototype pointer is immutable for an instance */.getPrototypeObject()
}

var typeDebugIds = new Map<Type, number>();
var nextDebugId = 0;
function getDebugId(type:Type) {
    if (!typeDebugIds.has(type)) {
        typeDebugIds.set(type, nextDebugId++);
    }
    return typeDebugIds.get(type);
}
var ADD_UNDEFINED_FOR_MAYBE_ABSENT_PROPERTIES = true;
var DEBUG_RECURSIVE_IDENTIFIER = 14;
/**
 * Ascribes a single type to a single concrete value.
 */
class TypeAscriberImpl implements TypeAscriber {
    private recursiveTypeIdentifiers = new Map<Instance, number>();
    private nextRecursiveTypeIdentifier = 0;
    private typeCache = new Map<Value, TupleType>();
    private onStack = new Set<Instance>();

    constructor(private inferencer:TypeInferencer, private lattice:CompleteLattice<TupleType>, private useSJSAscription:boolean) {
    }

    /**
     * Ascribes a type to a value, if a tighter type bound is desired: make use of the type specialized ascribers in this class
     */
    ascribeType(v:Value, path:string[]):TupleType {
        if (this.typeCache.has(v)) {
            return this.typeCache.get(v);
        }

        var type:TupleType;
        var DEBUG_ID = (<any>v).DEBUG_ID;
        switch (v.valueKind) {
            case AST.ValueKinds.Primitive:
                type = this.ascribePrimitiveType(<Primitive>v);
                break;
            case AST.ValueKinds.Object:
                // delay recursive resolution
                var instance = <Instance>v;
                if (this.onStack.has(instance)) {
                    var id:number;
                    if (!this.recursiveTypeIdentifiers.has(instance)) {
                        id = TypeImpls.RecursiveTupleTypeManager.prepare();
                        this.recursiveTypeIdentifiers.set(instance, id);
                    } else {
                        id = this.recursiveTypeIdentifiers.get(instance);
                    }
                    var recursiveMarker = new TypeImpls.RecursiveReferenceTypeImpl([id]);
                    var tuple = new TypeImpls.TupleTypeImpl([recursiveMarker]);

                    return tuple;
                } else {
                    this.onStack.add(instance);
                    type = this.ascribeObjectType(<Instance>v, path);
                    this.onStack.delete(instance);
                }
                break;
            default:
                throw new Error("Unhandled case: " + v.valueKind);
        }
        if (this.typeCache.has(v)) {
            throw new Error("Already in typecache?!?! " + DEBUG_ID);
        }
        this.typeCache.set(v, type);

        if (v.valueKind === AST.ValueKinds.Object && this.recursiveTypeIdentifiers.has(instance)) {
            TypeImpls.RecursiveTupleTypeManager.replace(this.recursiveTypeIdentifiers.get(instance), TypeImpls.TupleAccess.getObject(type), this.lattice.lub);
        }

        if (this.useSJSAscription) {
            if (TypeImpls.TupleAccess.isObject(type)) {
                // FIXME should merge MRO and MRW with those of the prototype...
                SJS.setMROAndMRW(TypeImpls.TupleAccess.getObject(type), this.lattice);
            }
        }

        return type;
    }

    /**
     * Ascribes a type to a primitive value
     */
    private ascribePrimitiveType(p:Primitive):TupleType /* no notion of primitive types, yet... */ {
        var primitiveType = TypeImpls.mapPrimitiveKindToType((p).primitiveKind);
        // box in tuple...
        var type = new TypeImpls.TupleTypeImpl([primitiveType]);
        return type
    }

    private ascribed = 0;

    /**
     * Ascribes a type to an object
     */
    private ascribeObjectType(instance:Instance, path:string[]):TupleType {
        var functionBot = TypeImpls.constants.FunctionBottom;
        this.ascribed++
        if (this.ascribed % 100 === 0) {
            // console.log("Ascribing object #%d (seen %d) at %s", this.ascribed, seen.length, path.join("."));
        }

        var classifications = new Set<SJS.ObjectClassification>();
        if (this.useSJSAscription) {
            classifications.add(SJS.selectObjectClassification(instance));
        }
        var classification = new TypeImpls.ObjectClassificationTypeImpl(classifications);

        // Collect and merges properties according to the object lattice, prototype properties are shadowed by definitely present properties.
        function makeFlatProperties(instance:Instance, that:TypeAscriberImpl):PropertyTypes {
            /**
             * Collapses a concrete prototype chain.
             */
            function collapsePrototypeChainIntoProperties(instance:Instance):{[n:string]:Value[]} {
                var allShapeGroups:Shape[][] = [];

                var prototype:Value = instance;
                while (prototype.valueKind === AST.ValueKinds.Object) {
                    var prototypeObject = <Instance>prototype;
                    allShapeGroups.push(prototypeObject.shapes);
                    prototype = prototypeObject.shapes[0].getPrototypeObject();
                }
                var propertyValues:{[n:string]:Value[]} = Object.create(null);
                var defPresentProperties = new Set<string>();
                allShapeGroups.forEach(shapeGroup => {
                    shapeGroup.forEach(shape => {
                        shape.getPropertyNames().forEach(n => {
                            if (!defPresentProperties.has(n)) {
                                var propertyValue = shape.getPropertyValue(n);
                                n = Misc.fieldNameAbstraction(n, classification);
                                if (propertyValues[n] === undefined) {
                                    propertyValues[n] = [];
                                }
                                if (n === 'prototype' && propertyValues[n].length > 0) {
                                    propertyValues[n][0] = propertyValue; // FIXME always picks the latest .prototype assignment, introducing weird flow-sensitivity that is correct in practice. Otherwise (function-)prototype-reassignments are merged with the default empty object...
                                } else {
                                    propertyValues[n].push(propertyValue);
                                }
                            }
                        });
                    });
                    shapeGroup[0/* pick any shape...*/].getPropertyNames().forEach(n => {
                        if (!shapeGroup.some(shape => !shape.hasProperty(n))) {
                            // all shapes at this prototype level has the property
                            defPresentProperties.add(n);
                        }
                    });
                });
                if (ADD_UNDEFINED_FOR_MAYBE_ABSENT_PROPERTIES) {
                    for (var p in propertyValues) {
                        if (!defPresentProperties.has(p)) {
                            propertyValues[p].push(new Impls.PrimitiveImpl(AST.PrimitiveKind.Undefined));
                        }
                    }
                }
                return propertyValues;
            }


            var properties = collapsePrototypeChainIntoProperties(instance);
            var propertyTypes:PropertyTypes = Object.create(null);
            for (var p in properties) {
                var property:Value[] = properties[p];
                if (property !== undefined) {
                    var propertyType:TupleType;
                    propertyType = that.inferencer.inferType(property, path.concat([p]));
                    propertyTypes[p] = propertyType;
                }
            }
            return propertyTypes;
        }

        var propertyTypes:PropertyTypes;
        var readOnlyPropertyNames:Set<string>;
        if (this.useSJSAscription) {
            var flatteningResult = SJS.makeFlatProperties(instance, this.inferencer, classification);
            propertyTypes = flatteningResult[0];
            readOnlyPropertyNames = flatteningResult[1];
        } else {
            propertyTypes = makeFlatProperties(instance, this);
            readOnlyPropertyNames = new Set<string>();
        }

        var functionType:FunctionType;
        if (instance.functionUsages.length !== 0) {
            functionType = this.inferencer.inferFunctionType(instance.functionUsages, path.concat(["<FUN>"]));
        } else {
            functionType = functionBot;
        }

        var objectType:ObjectType = new TypeImpls.ObjectTypeImpl(propertyTypes, functionType, classification, readOnlyPropertyNames);
        if(this.useSJSAscription){
            SJS.setObjectAllocationContext(objectType, instance.allocationContext);
        }

        var type = new TypeImpls.TupleTypeImpl([objectType]);
        return type;
    }

    ascribeFunctionType(sig:DynamicFunctionSignature, path:string[]):SingleFunctionType {
        var base = this.ascribeType(sig.base, path.concat(["<BASE>"]));
        var args = sig.args.map((arg, index) => this.ascribeType(arg, path.concat([util.format("<ARG-%d>", index)])));
        var result = this.ascribeType(sig.result, path.concat(["<RETURN>"]));
        var callKinds = new Set<TypeImpls.CallKinds>();
        if (sig.isConstructorCall) {
            callKinds.add(TypeImpls.CallKinds.Constructor);
        }
        var type = new TypeImpls.SingleFunctionTypeImpl(base, args, result, callKinds);
        return type;
    }
}
/**
 * Infers a single type for a collection of concrete values.
 */
export class TypeInferencerImpl implements TypeInferencer {
    private ascriber:TypeAscriber;

    constructor(private lattice:CompleteLattice<TupleType>, private initialFunctionTypeMaker:MergeOperator<FunctionType>, useSJSAscription?:boolean) {
        TypeImpls.RecursiveTupleTypeManager.reset();
        this.ascriber = new TypeAscriberImpl(this, lattice, !!useSJSAscription);
    }

    inferType(values:Value[], path:string[]):TupleType {
        var types = values.map(v => this.ascriber.ascribeType(v, path));
        var inferred = types.slice(1).reduce<TupleType>((t1:TupleType, t2:TupleType) => this.lattice.lub(t1, t2), types[0]);
        return inferred;
    }

    inferObjectType(instances:Instance[], path:string[]):ObjectType {
        var types = instances.map(instance => this.ascriber.ascribeType(instance, path));
        var lubbedObjectTuple = types.slice(1).reduce<TupleType>((t1:TupleType, t2:TupleType) => this.lattice.lub(t1, t2), types[0]);
        return TypeImpls.TupleAccess.getObject(lubbedObjectTuple);
    }

    inferFunctionType(signatures:DynamicFunctionSignature[], path:string[]):FunctionType {
        var types = signatures.map(e => this.ascriber.ascribeFunctionType(e, path));
        return types.reduce<FunctionType>((t1:FunctionType, t2:FunctionType) => this.initialFunctionTypeMaker(t1, t2), types[0]);
    }

    getAscriber() {
        return this.ascriber;
    }
}
