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
///<reference path="types.d.ts"/>
import AST = require('./TraceLanguageAST');
import Misc = require('./Misc');
import Impls = require('./trace-replaying/HeapHistoryImpls');

export enum ObjectClassification {
    Object,
    Arguments,
    Map,
    Array,
    Function
}

import TypeImpls = require('./typing/TypeImpls');

interface FlattenedShape {
    [n:string]:Value[]
}

var topPropertyNames = new Set();
// .constructor does not really fit into the prototype hierarchy, and it will break prototype property invariance checking later...
topPropertyNames.add('constructor');

var objectAllocationContexts = new WeakMap<ObjectType, ScopeID>();
export function setObjectAllocationContext(objectType: ObjectType, scopeID: ScopeID){
    objectAllocationContexts.set(objectType, scopeID);
}
export function getObjectAllocationContext(objectType: ObjectType){
    return objectAllocationContexts.get(objectType);
}

export function selectObjectClassification(instance:Instance):ObjectClassification {
    var shapes = instance.shapes;
    for (var i = 0; i < shapes.length; i++) {
        var shape = shapes[i];
        if (shape.hasObjectClassification()) {
            // select the first classification - if multiple classifications exists, type errors will occur..
            // (Arrays & arguments constructed with a classification)
            return shape.getObjectClassification();
        }
    }
    // case: Object without any writes at all default to Object
    return ObjectClassification.Object;
}

/**
 * Flattens an instance to a map from property name to a type, also produces a set of property names that are only present in the prototypes of the instance.
 *
 * Only property names that are present in the initializer of the object are considered // FIXME support constructors
 *
 * The type for each property is dictated by the top most prototype as this will model the subtyping checks that would occur if explicit prototype tracking was done.
 *
 * The SJS-map type does not use prototypes
 *
 * The first non-undefined write to a property decides the type of the property, e.g. if a write sequence is [`undefined`, `number`, `string`], then the type of the property is `number`.
 * In the case of null/object writes, all object types are collected and merged.
 * Property writes that are not used in this decision will lead to type errors later.
 */
export function makeFlatProperties(instance:Instance, inferencer:TypeInferencer, classification:ObjectClassificationType):[PropertyTypes,Set<string>] {
    var isArray = classification.classifications.has(ObjectClassification.Array);
    var isArguments = classification.classifications.has(ObjectClassification.Arguments);
    var isMap = classification.classifications.has(ObjectClassification.Map);

    function selectTypeValues(values:Value[]):Value[] {
        var seenNumber = false;
        var seenString = false;
        var seenBoolean = false;
        var seenNull = false;
        var seenObject = false;
        var selected = values.filter(v => {
            if (v.valueKind === AST.ValueKinds.Object) {
                if (seenNumber || seenString || seenBoolean) {
                    return false;
                } else {
                    seenObject = true;
                    return true;
                }
            } else /* primitive */{
                switch ((<Primitive>v).primitiveKind) {
                    case AST.PrimitiveKind.Number:
                        if (seenString || seenBoolean || seenObject || seenNull) {
                            return false;
                        } else {
                            seenNumber = true;
                            return true;
                        }
                    case AST.PrimitiveKind.String:
                        if (seenNumber || seenBoolean || seenObject || seenNull) {
                            return false;
                        } else {
                            seenString = true;
                            return true;
                        }
                    case AST.PrimitiveKind.Boolean:
                        if (seenNumber || seenString || seenObject || seenNull) {
                            return false;
                        } else {
                            seenBoolean = true;
                            return true;
                        }
                    case AST.PrimitiveKind.Null:
                        if (seenNumber || seenString || seenBoolean) {
                            return false;
                        } else {
                            seenNull = true;
                            return true;
                        }
                    case AST.PrimitiveKind.Undefined:
                        return true;
                    default:
                        throw new Error("Unhandled kind: " + (<Primitive>v).primitiveKind);
                }
            }
        });
        return selected;
    }

    function makeFlattenedShape(shapes:Shape[], prototypeIndex:number):FlattenedShape {
        var flattened:FlattenedShape = Object.create(null);
        var initializer = shapes[0];
        var propertyNames = initializer.getPropertyNames();

        // abstract none/some/all field names according to the object classification, and remove any abstract field names
        var concretePropertyNames = propertyNames.map(n => Misc.fieldNameAbstraction(n, classification)).filter(n => !Misc.isAbstractFieldName(n));

        // collect values for the concrete property names
        concretePropertyNames.forEach(n => {
            // collect all values for this property name
            var values:Value[] = [];
            shapes.forEach(shape => {
                if (shape.hasProperty(n)) {
                    values.push(shape.getPropertyValue(n));
                }
            });
            // use only one kind of types
            flattened[n] = selectTypeValues(values);
        });

        // collect values for the abstract property names
        if (isMap) {
            var values:Value[] = [];
            shapes.slice(1 /* maps are empty initially, but they have native properties... */).forEach(shape => {
                shape.getPropertyNames().forEach(n => {
                    // get all values - if static field writes are collected here, the type might be wrong. But in that case, a type error will be produced for the static field write anyway...
                    values.push(shape.getPropertyValue(n));
                });
            });
            // use only one kind of types
            flattened[Misc.getAbstractMapFieldName()] = selectTypeValues(values);
        }
        if (isArray) {
            var values:Value[] = [];
            var foundOne = false;
            shapes.forEach(shape => {
                shape.getPropertyNames().forEach(n => {
                    var isArrayIndex = Misc.isAbstractArrayFieldName(Misc.fieldNameAbstraction(n, classification));
                    if (isArrayIndex && !(prototypeIndex > 0)) {
                        foundOne = true;
                        values.push(shape.getPropertyValue(n));
                    }
                });

            });
            // use only one kind of types
            var selected = selectTypeValues(values);
            var propertyName = Misc.getAbstractArrayFieldName();
            flattened[propertyName] = selected;
        }

        return flattened;
    }

    function getPrototypeChain():Instance[] {
        var chain:Instance[] = [];
        if (isMap) {
            // Design choice: maps does *NOT* consider their prototype properties
            chain.push(instance);
        } else {
            var current:Value = instance;
            while (current.valueKind === AST.ValueKinds.Object) {
                var currentObject = <Instance>current;
                chain.push(currentObject);
                current = currentObject.shapes[0].getPrototypeObject();
            }
        }
        return chain;
    }

    function getFlattenedShapeChain():FlattenedShape[] {
        return getPrototypeChain().map((instance:Instance, prototypeIndex:number) => makeFlattenedShape(instance.shapes, prototypeIndex));
    }

    var propertyTypes:PropertyTypes = Object.create(null);
    getFlattenedShapeChain().forEach((flattenedShapes:FlattenedShape, prototypeIndex:number)=> {
            for (var propertyName in flattenedShapes) {
                if (prototypeIndex !== 0 && Misc.isAbstractFieldName(propertyName)) {
                    // throw new Error("Prototypes should not use abstract field names! (." + propertyName + ")");
                    continue;
                }
                // non-prototype defines the type
                var propertyIsOverridden = Object.hasOwnProperty.call(propertyTypes, propertyName);
                // except if the non-prototype property is undefined and the prototype is non-undefined
                var isOverriddenWithUndefined = propertyIsOverridden && TypeImpls.isTupleTypeEqual(propertyTypes[propertyName], new TypeImpls.TupleTypeImpl([TypeImpls.constants.UndefinedTop]));
                if (propertyIsOverridden && !isOverriddenWithUndefined) {
                    // skip
                } else {
                    var propertyValues:Value[] = flattenedShapes[propertyName];
                    // TODO check that prototypes do *not* introduce absctractFieldNames!
                    var propertyType:TupleType;
                    if (propertyValues.length === 0) {
                        /* might happen for arrays */
                    } else {
                        if (topPropertyNames.has(propertyName)) {
                            propertyType = TypeImpls.constants.Top;
                        } else {
                            if (propertyName === 'prototype' && propertyValues.length > 1 && propertyValues[0].valueKind === AST.ValueKinds.Object && (<Instance>propertyValues[0]).shapes[0].getIsDotPrototype()) {
                                // if the initial .prototype value is redefined, the initial value is not used for type ascription
                                propertyValues = propertyValues.slice(1);
                            }
                            propertyType = inferencer.inferType(propertyValues, []);
                        }
                        propertyTypes[propertyName] = propertyType;
                    }
                }
            }
        }
    );

    if (isArray && propertyTypes[Misc.getAbstractArrayFieldName()] === undefined) {
        propertyTypes[Misc.getAbstractArrayFieldName()] = TypeImpls.constants.Top;
    }

    // upgrade `undefined` to `Top`, `null` to `TopObject`
    var undefType = new TypeImpls.TupleTypeImpl([TypeImpls.constants.UndefinedTop]);
    var nullType = new TypeImpls.TupleTypeImpl([TypeImpls.constants.NullTop]);
    var topObjectType = new TypeImpls.TupleTypeImpl([TypeImpls.constants.ObjectTop]);
    for (var n in propertyTypes) {
        var propertyType = propertyTypes[n];
        if (TypeImpls.isTupleTypeEqual(propertyType, undefType)) {
            propertyTypes[n] = TypeImpls.constants.Top;
        } else if (TypeImpls.isTupleTypeEqual(propertyType, nullType)) {
            //propertyTypes[n] = topObjectType;
        }
    }

    var prototypeOnlyPropertyNames = new Set<string>();
    var base = instance.shapes[0];
    for (var n in propertyTypes) {
        if (!base.hasProperty(n) && !Misc.isAbstractFieldName(n)) {
            prototypeOnlyPropertyNames.add(n);
        }
    }

    return [propertyTypes, prototypeOnlyPropertyNames];
}

export function isAbstract(object:ObjectType, MRO:Map<string, TupleType>, MRW:Map<string, TupleType>, debug:boolean = false) {
    var hasAllTheRequiredProperties = true;
    MRO.forEach((type:TupleType, name:string) => {
        if (object.properties[name] === undefined || !TypeImpls.isTupleTypeEqual(type, object.properties[name])) {
            if (debug) {
                if (object.properties[name] === undefined) {
                    console.log("Missing MRO property: .%s", name);
                } else {
                    console.log("MRO Property of wrong type: %s:: %s vs %s", name, TypeImpls.toPrettyString(type), TypeImpls.toPrettyString(object.properties[name]));
                    TypeImpls.isTupleTypeEqual(type, object.properties[name], true);
                }
            }
            hasAllTheRequiredProperties = false;
        }
    });
    if (hasAllTheRequiredProperties) {
        MRW.forEach((type:TupleType, name:string) => {
            if (object.readOnlyPropertyNames.has(name)) {
                if (debug) {
                    console.log("MRW required for .%s, but it is RO", name);
                }
                hasAllTheRequiredProperties = false;
            } else {
                if (object.properties[name] === undefined || !TypeImpls.isTupleTypeEqual(type, object.properties[name])) {
                    if (debug) {
                        if (object.properties[name] === undefined) {
                            console.log("Missing MRW property: .%s", name);
                        } else {
                            console.log("MRW Property of wrong type: %s:: %s vs %s", name, TypeImpls.toPrettyString(type), TypeImpls.toPrettyString(object.properties[name]));
                            TypeImpls.isTupleTypeEqual(type, object.properties[name], true);
                        }
                    }
                    hasAllTheRequiredProperties = false;
                }
            }
        });
    }
    return !hasAllTheRequiredProperties;
}

export function setMROAndMRW(object:ObjectType, lattice:CompleteLattice<TupleType>) {
    if (object.MRO !== undefined || object.MRW !== undefined) {
        throw new Error("MRO/MRW already defined!?!?");
    }
    var methods:SingleFunctionType[] = [];
    for (var name in object.properties) {
        var property = object.properties[name];

        if (TypeImpls.TupleAccess.isObject(property)) {
            var funcType = TypeImpls.TupleAccess.getObject(property).functionType;
            switch (funcType.functionKind) {
                case TypeImpls.FunctionKinds.Single:
                    methods = methods.concat([<SingleFunctionType>funcType]);
                    break;
                case TypeImpls.FunctionKinds.Intersection:
                    methods = methods.concat((<IntersectionFunctionType>funcType).members);
                    break;
                case TypeImpls.FunctionKinds.Top:
                    break;
                case TypeImpls.FunctionKinds.Bottom:
                    break;
                default:
                    throw new Error("Unhandled kind: " + funcType.functionKind);

            }
        }
    }

    var MRO = new Map<string, TupleType>();
    var MRW = new Map<string, TupleType>();

    methods.map(m => m.base).forEach(receiver => {
        if (TypeImpls.TupleAccess.isObject(receiver)) {
            var receiverObject = TypeImpls.TupleAccess.getObject(receiver);
            for (var name in receiverObject.properties) {
                var targetMap:Map<string, TupleType>;
                if (receiverObject.readOnlyPropertyNames.has(name)) {
                    targetMap = MRO;
                } else {
                    targetMap = MRW;
                }
                var property = receiverObject.properties[name];
                if (!targetMap.has(name)) {
                    targetMap.set(name, property);
                } else {
                    targetMap.set(name, lattice.lub(targetMap.get(name), property));
                }
            }
        }
    });
    // move from MRO to MRW in case of conflicts
    MRO.forEach((type:TupleType, name:string) => {
        if (MRW.has(name)) {
            MRW.set(name, lattice.lub(MRW.get(name), property));
        }
    });


    object.isAbstract = isAbstract(object, MRO, MRW);
    object.MRO = MRO;
    object.MRW = MRW;

}
