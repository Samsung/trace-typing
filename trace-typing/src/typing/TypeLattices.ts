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
import AST = require('../TraceLanguageAST');
import TypeImpls = require('./TypeImpls');
import Misc = require('../Misc');
import SJS = require('../SJS');
import TypeInferencerExtras = require('./TypeInferencerExtras');

class CompleteLatticeImpl<T> implements CompleteLattice<T> {
    constructor(public top:T, public bot:T, public lub:(t1:T, t2:T) => T) {
    }
}
/**
 * A box for initializing recursive objects
 */
interface Box<T> {
    content: T
}
var DEBUG = false;
export function hasSameBaseAndArguments(f1:SingleFunctionType, f2:SingleFunctionType) {
    return f1.args.length === f2.args.length && TypeImpls.isTupleTypeEqual(f1.base, f2.base) && !f2.args.some((arg:TupleType, argIndex:number) => !TypeImpls.isTupleTypeEqual(arg, f1.args[argIndex]));
}

function makeFunctionIntersectionTypeLattice(typeLattice:Box<CompleteLattice<TupleType>>, top:FunctionType, bot:FunctionType):CompleteLattice<FunctionType> {
    function lub(t1:FunctionType, t2:FunctionType):FunctionType {
        // trivial cases
        if (t1 === t2) {
            return t1;
        }
        if (t1 === bot) {
            return t2;
        }
        if (t2 === bot) {
            return t1;
        }
        if (t1 === top || t2 === top) {
            return top;
        }
        var i1 = <IntersectionFunctionType>t1;
        var i2 = <IntersectionFunctionType>t2;
        var f1s = i1.members;
        var f2s = i2.members;

        var intersected:SingleFunctionType[] = [];

        // compute the intersection of the two function sets, but merge the return type of functions with same base and arguments
        f1s.forEach(f1 => {
            if (f2s.some(f2 => TypeImpls.isSingleFunctionTypeEqual(f1, f2))) {
                intersected.push(f1);
            } else {
                var sameBaseAndArgument = f2s.filter(f2 => hasSameBaseAndArguments(f1, f2));
                if (sameBaseAndArgument.length > 1) {
                    // FIXME: deduce cause
                    console.error("Multiple single functions in intersection type with same base/arguments types?!");
                }
                if (sameBaseAndArgument.length > 0) {
                    var result = typeLattice.content.lub(f1.result, sameBaseAndArgument[0].result);
                    var callKinds = Misc.mergeFlatSets(sameBaseAndArgument[0].callKinds, f1.callKinds); // TODO ensure these sets are equal?
                    intersected.push(new TypeImpls.SingleFunctionTypeImpl(f1.base, f1.args.slice(), result, callKinds));
                }
            }
        });

        return new TypeImpls.IntersectionFunctionTypeImpl(intersected);
    }

    return new CompleteLatticeImpl<FunctionType>(top, bot, lub);
}
var path:string[] = [];
function makeFunctionPointwiseUnionTypeLattice(typeLattice:Box<CompleteLattice<TupleType>>, top:FunctionType, bot:FunctionType):CompleteLattice<FunctionType> {
    var undefinedT = new TypeImpls.TupleTypeImpl([TypeImpls.constants.UndefinedTop]);

    function lub(t1:SingleFunctionType, t2:SingleFunctionType):FunctionType {
        // trivial cases
        if (t1 === t2) {
            return t1;
        }
        if (t1 === bot) {
            return t2;
        }
        if (t2 === bot) {
            return t1;
        }
        if (t1 === top || t2 === top) {
            return top;
        }

        var args1 = t1.args;
        var args2 = t2.args;
        var mergedArgs:TupleType[] = [];
        for (var i = 0; i < Math.max(args1.length, args2.length); i++) {
            var f1HasArg = Misc.HOP(args1, i + '');
            var f2HasArg = Misc.HOP(args2, i + '');
            if (f1HasArg && f2HasArg) {
                var mergedArg = typeLattice.content.lub(args1[i], args2[i]);
                mergedArgs[i] = mergedArg;
            } else if (!f1HasArg) {
                mergedArgs[i] = typeLattice.content.lub(undefinedT, args2[i]);
            } else if (!f2HasArg) {
                mergedArgs[i] = typeLattice.content.lub(undefinedT, args1[i]);
            }
        }
        var mergedBaseTypes = typeLattice.content.lub(t1.base, t2.base);
        var mergedFunctionTypes = typeLattice.content.lub(t1.result, t2.result);
        var mergedCallKinds = Misc.mergeFlatSets(t1.callKinds, t2.callKinds);
        return new TypeImpls.SingleFunctionTypeImpl(mergedBaseTypes, mergedArgs, mergedFunctionTypes, mergedCallKinds);
    }

    return new CompleteLatticeImpl<FunctionType>(top, bot, lub);
}

function lubReadOnlyPropertyNames(ro1:Set<string>, ro2:Set<string>, lubbedProperties:PropertyTypes) {
    // lubbedRo = ((ro1 u ro2) n names(lubbedProperties))

    var lubbedRo = new Set<string>();
    ro1.forEach(n => {
        if (Object.hasOwnProperty.call(lubbedProperties, n))lubbedRo.add(n)
    });
    ro2.forEach(n => {
        if (Object.hasOwnProperty.call(lubbedProperties, n))lubbedRo.add(n)
    });
    return lubbedRo;
}
function lubClassfication(t1:ObjectClassificationType, t2:ObjectClassificationType) {
    if (TypeImpls.isObjectClassificationTypeEqual(t1, t2)) {
        return t1;
    }
    var merged = new Set<SJS.ObjectClassification>();
    t1.classifications.forEach(classification => merged.add(classification));
    t2.classifications.forEach(classification => merged.add(classification));

    return new TypeImpls.ObjectClassificationTypeImpl(merged);

}
function makeObjectTypeLattice(propertyTypeLattice:Box<CompleteLattice<TupleType>>, functionLattice:Box<CompleteLattice<FunctionType>>, useSJSAscription:boolean):CompleteLattice<ObjectType> {
    var objectBot = TypeImpls.constants.ObjectBottom;
    var objectTop = TypeImpls.constants.ObjectTop;
    var bot = TypeImpls.constants.Bottom;

    function lub(t1:ObjectType, t2:ObjectType):ObjectType {
        // trivial cases
        if (TypeImpls.isObjectTypeEqual(t1, t2)) {
            return t1;
        }
        if (t1 === objectBot) {
            return t2;
        }
        if (t2 === objectBot) {
            return t1;
        }
        if (t1 === objectTop || t2 === objectTop) {
            return objectTop;
        }

        if(useSJSAscription && (t1.isAbstract !== t2.isAbstract)){
            // console.warn("Merging abstract and concrete object to object top...")
            return objectTop;
        }

        var ps1 = t1.properties;
        var ps2 = t2.properties;
        var mergedProperties:PropertyTypes = Object.create(null);
        Object.getOwnPropertyNames(ps1).concat(Object.getOwnPropertyNames(ps2)).forEach(p => {
                var tp1:TupleType = Misc.HOP(ps1, p) ? ps1[p] : bot;
                var tp2:TupleType = Misc.HOP(ps2, p) ? ps2[p] : bot;
                if (tp1 === bot || tp2 === bot) {
                    return;
                }

                path.push(p);

                var mergedProperty:TupleType;
                if (TypeImpls.isTupleTypeEqual(tp1, tp2)) {
                    mergedProperty = tp1;
                } else {
                    mergedProperty = propertyTypeLattice.content.lub(tp1, tp2);
                }
                if (mergedProperty !== bot) {
                    // console.log("Changed prop %s:\n%s\nu\n%s\n=\n%s", path.join('.'), TypeImpls.toPrettyString(tp1), TypeImpls.toPrettyString(tp2), TypeImpls.toPrettyString(mergedProperty));
                    mergedProperties[p] = mergedProperty;
                }
                path.pop();
            }
        );
        var mergedFunctionTypes = functionLattice.content.lub(t1.functionType, t2.functionType);
        var mergedClassification = lubClassfication(t1.objectClassification, t2.objectClassification);
        var mergedReadOnlyPropertyNames = lubReadOnlyPropertyNames(t1.readOnlyPropertyNames, t2.readOnlyPropertyNames, mergedProperties);
        var merged = new TypeImpls.ObjectTypeImpl(mergedProperties, mergedFunctionTypes, mergedClassification, mergedReadOnlyPropertyNames);
        if (TypeImpls.isObjectTypeEqual(merged, t1)) {
            return t1;
        }
        if (TypeImpls.isObjectTypeEqual(merged, t2)) {
            return t2;
        }
        if (TypeImpls.isObjectTypeEqual(merged, TypeImpls.constants.ObjectTop)) {
            return TypeImpls.constants.ObjectTop;
        }
        return merged;
    }

    return new CompleteLatticeImpl<ObjectType>(objectTop, objectBot, lub);
}

function makeBotTopLattice<T>(bot:T, top:T, flip:boolean):CompleteLattice<T> {
    if (flip) {
        var tmp = top;
        top = bot;
        bot = tmp;
    }
    return new CompleteLatticeImpl<T>(bot, top, function (t1:T, t2:T):T {
        if (t1 === t2) {
            return t1;
        }
        if (t1 === bot) {
            return t2;
        }
        if (t2 === bot) {
            return t1;
        }
        if (t1 === top || t2 === top) {
            return top;
        }
        throw new Error("Unhandled trival lub case: lub(" + t1 + ", " + t2 + ")");
    });
}

function makeFullTypeCrossProductLubLattice(objectLattice:Box<CompleteLattice<ObjectType>>, multiKindsYieldsTop:boolean, asGlb:boolean, useSJSAscription:boolean):CompleteLattice<TupleType> {
    // TODO refactor to make the flipping more elegant

    var typeLattices:Box<CompleteLattice<Type>>[] = [];
    var top = TypeImpls.constants.Top;
    var bot = TypeImpls.constants.Bottom;
    if (asGlb) {
        var tmp = top;
        top = bot;
        bot = tmp;
    }
    function recursiveReferenceLub(t1:RecursiveReferenceType, t2:RecursiveReferenceType):RecursiveReferenceType {
        var top = TypeImpls.constants.RecursiveReferenceTop;
        var bot = TypeImpls.constants.RecursiveReferenceBottom;
        if (asGlb) {
            var tmp = top;
            top = bot;
            bot = tmp;
        }
        if (TypeImpls.isRecursiveReferenceTypeEqual(t1, t2)) {
            return t1;
        }
        if (t1 === bot) {
            return t2;
        }
        if (t2 === bot) {
            return t1;
        }
        if (t1 === top || t2 === top) {
            return top;
        }
        // TODO support merge of multiple recursive references by using a powerset of references...
        // console.warn("Merging recursive references %s and %s to RecursiveReferenceTop at %s", t1.id, t2.id, path.join("."));
        return top;
    }

    function simpleObjectLub(t1:ObjectType, t2:ObjectType):ObjectType {
        var top = TypeImpls.constants.ObjectTop;
        var bot = TypeImpls.constants.ObjectBottom;

        if (asGlb) {
            var tmp = top;
            top = bot;
            bot = tmp;
        }

        if (t1 === bot) {
            return t2;
        }
        if (t2 === bot) {
            return t1;
        }
        if (t1 === top || t2 === top) {
            return top;
        }
        // (Some U Some) handled elsewhere, (Some U ?) handled above
        throw new Error("Unhandled simple object lub case: lub(" + t1 + ", " + t2 + ")");
    }

    typeLattices[TypeImpls.TypeKinds.Object] = box(new CompleteLatticeImpl(TypeImpls.constants.ObjectBottom, TypeImpls.constants.ObjectTop, simpleObjectLub));
    typeLattices[TypeImpls.TypeKinds.String] = box(makeBotTopLattice(TypeImpls.constants.StringBottom, TypeImpls.constants.StringTop, asGlb));
    typeLattices[TypeImpls.TypeKinds.Number] = box(makeBotTopLattice(TypeImpls.constants.NumberBottom, TypeImpls.constants.NumberTop, asGlb));
    typeLattices[TypeImpls.TypeKinds.Boolean] = box(makeBotTopLattice(TypeImpls.constants.BooleanBottom, TypeImpls.constants.BooleanTop, asGlb));
    typeLattices[TypeImpls.TypeKinds.Undefined] = box(makeBotTopLattice(TypeImpls.constants.UndefinedBottom, TypeImpls.constants.UndefinedTop, asGlb));
    typeLattices[TypeImpls.TypeKinds.Null] = box(makeBotTopLattice(TypeImpls.constants.NullBottom, TypeImpls.constants.NullTop, asGlb));
    typeLattices[TypeImpls.TypeKinds.RecursiveReference] = box(new CompleteLatticeImpl(TypeImpls.constants.RecursiveReferenceTop, TypeImpls.constants.RecursiveReferenceBottom, recursiveReferenceLub));
    typeLattices[TypeImpls.TypeKinds.ObjectTopDueToRecursion] = box(makeBotTopLattice(TypeImpls.constants.ObjectTopDueToRecursionTop, TypeImpls.constants.ObjectTopDueToRecursionBottom, asGlb));

    function checkTupleConsistency(t1:TupleType, t2:TupleType) {
        if (DEBUG) {
            if (t1.elements.length !== t2.elements.length) {
                throw new Error("Different tuple lenghts: " + t1.elements.length + " vs " + t2.elements.length);
            }
            for (var i = 0; i < t1.elements.length; i++) {
                var e1 = t1.elements[i];
                var e2 = t2.elements[i];

                if (e1.typeKind !== e2.typeKind) {
                    throw new Error("Type error: tuple elements (" + i + ") are not of the matching kinds: " + e1.typeKind + " vs " + e2.typeKind);
                }
            }
        }
    }

    var lubCache = new Map<TupleType, Map<TupleType, TupleType>>();
    var depth = 0;
    var recursionGuard = new Map<ObjectType, Map<ObjectType, RecursiveReferenceType>>();
    var RESOLVE_RECURSIVE_MERGES = true;

    function lub(t1:TupleType, t2:TupleType):TupleType {
        if (lubCache.has(t1) && lubCache.get(t1).has(t2)) {
            return lubCache.get(t1).get(t2);
        }
        if (TypeImpls.isTupleTypeEqual(t1, t2)) {
            return t1;
        }
        if (t1 === bot) {
            return t2;
        }
        if (t2 === bot) {
            return t1;
        }
        if (t1 === top || t2 === top) {
            return top;
        }

        checkTupleConsistency(t1, t2);

        if (useSJSAscription) {
            if (TypeImpls.TupleAccess.isUndefined(t1) || TypeImpls.TupleAccess.isNull(t1)) {
                return t2;
            }
            if (TypeImpls.TupleAccess.isUndefined(t2) || TypeImpls.TupleAccess.isNull(t2)) {
                return t1;
            }
        }

        var lubbedElements:Type[] = [];
        // merge all elements, but treat objects as a separate case due to possible recursion
        for (var i = 0; i < t1.elements.length; i++) {
            var e1 = t1.elements[i];
            var e2 = t2.elements[i];
            if (e1.typeKind === TypeImpls.TypeKinds.Object) {
                var o1 = <ObjectType>e1;
                var o2 = <ObjectType>e2;
                if (o1.objectKind === TypeImpls.ObjectKinds.Some && o2.objectKind === TypeImpls.ObjectKinds.Some) {
                    if (!recursionGuard.has(o1)) {
                        recursionGuard.set(o1, new Map<ObjectType, RecursiveReferenceType>());
                    }
                    if (recursionGuard.get(o1).has(o2)) {
                        if (RESOLVE_RECURSIVE_MERGES) {
                            var rec = recursionGuard.get(o1).get(o2);
                            var rec1 = <RecursiveReferenceType>t1.elements[TypeImpls.TypeKinds.RecursiveReference];
                            var rec2 = <RecursiveReferenceType>t2.elements[TypeImpls.TypeKinds.RecursiveReference];
                            lubbedElements[TypeImpls.TypeKinds.Object] = TypeImpls.constants.ObjectBottom;
                            lubbedElements[TypeImpls.TypeKinds.RecursiveReference] = recursiveReferenceLub(rec, recursiveReferenceLub(rec1, rec2));
                        } else {
                            console.warn("Resolving recursive merge with " + (asGlb ? "ObjectBottom" : "ObjectTop"));
                            lubbedElements[TypeImpls.TypeKinds.Object] = asGlb ? TypeImpls.constants.ObjectBottom : TypeImpls.constants.ObjectTop;
                        }
                    } else {
                        var recursiveReferenceId = TypeImpls.RecursiveTupleTypeManager.prepare();
                        recursionGuard.get(o1).set(o2, new TypeImpls.RecursiveReferenceTypeImpl(recursiveReferenceId));
                        var mergedObjectType = objectLattice.content.lub(o1, o2);
                        lubbedElements[TypeImpls.TypeKinds.Object] = mergedObjectType;
                        recursionGuard.get(o1).delete(o2);
                        TypeImpls.RecursiveTupleTypeManager.replace(recursiveReferenceId, mergedObjectType, lub);
                    }
                    continue;
                }
            }
            lubbedElements[i] = typeLattices[e1.typeKind].content.lub(e1, e2);
        }

        var result:TupleType = new TypeImpls.TupleTypeImpl(lubbedElements);
        if (asGlb) {
            var changed = false;
            // avoid removing recursive/non-recursive objects // TODO RecursiveReference and Object should be in the same TypeLattice...
            if (!TypeImpls.TupleAccess.isObject(result)) {
                if (TypeImpls.TupleAccess.isRecursiveReference(t1) && TypeImpls.TupleAccess.isObject(t2)) {
                    lubbedElements[TypeImpls.TypeKinds.Object] = TypeImpls.TupleAccess.getObject(t2);
                    changed = true;
                }
                if (TypeImpls.TupleAccess.isRecursiveReference(t2) && TypeImpls.TupleAccess.isObject(t1)) {
                    changed = true;
                    lubbedElements[TypeImpls.TypeKinds.Object] = TypeImpls.TupleAccess.getObject(t1);
                }
                if (changed) {
                    // console.log("Restored Object");
                }

            }
            if (!TypeImpls.TupleAccess.isRecursiveReference(result)) {
                if (TypeImpls.TupleAccess.isRecursiveReference(t1) && TypeImpls.TupleAccess.isObject(t2)) {
                    changed = true;
                    lubbedElements[TypeImpls.TypeKinds.RecursiveReference] = TypeImpls.TupleAccess.getRecursiveReference(t1);
                }
                if (TypeImpls.TupleAccess.isRecursiveReference(t2) && TypeImpls.TupleAccess.isObject(t1)) {
                    changed = true;
                    lubbedElements[TypeImpls.TypeKinds.RecursiveReference] = TypeImpls.TupleAccess.getRecursiveReference(t2);
                }
                if (changed) {
                    // console.log("Restored recursive reference");
                }
            }
            result = new TypeImpls.TupleTypeImpl(lubbedElements);
        }

        // preserve reference equality
        if (TypeImpls.isTupleTypeEqual(result, TypeImpls.constants.Top)) {
            result = TypeImpls.constants.Top;
        } else if (TypeImpls.isTupleTypeEqual(result, TypeImpls.constants.Bottom)) {
            result = TypeImpls.constants.Bottom;
        }

        // TODO avoid this hack by using powersets of recursive references earlier...
        if (TypeImpls.TupleAccess.isRecursiveReference(result) && TypeImpls.TupleAccess.getRecursiveReference(result) === TypeImpls.constants.RecursiveReferenceTop) {
            console.warn("Resolving ambiguous recursive reference merge with ObjectTop");
            TypeImpls.TupleAccess.setBottomRecursiveReference(result);
            TypeImpls.TupleAccess.setObjectTopDueToRecursion(result);
        }

        if (multiKindsYieldsTop) {
            var kindsCount = 0;
            if (TypeImpls.TupleAccess.isObject(result) || TypeImpls.TupleAccess.isRecursiveReference(result) || TypeImpls.TupleAccess.isNull(result)) {
                // counts as one
                kindsCount++;
            }
            if (TypeImpls.TupleAccess.isNumber(result)) {
                kindsCount++;
            }
            if (TypeImpls.TupleAccess.isString(result)) {
                kindsCount++;
            }
            if (TypeImpls.TupleAccess.isBoolean(result)) {
                kindsCount++;
            }
            if (TypeImpls.TupleAccess.isUndefined(result)) {
                // do NOT count
            }
            if (kindsCount > 1) {
                result = top;
            }
        }

        // preserve unchanged result
        if (TypeImpls.isTupleTypeEqual(result, t1)) {
            result = t1;
        }
        if (TypeImpls.isTupleTypeEqual(result, t2)) {
            result = t2;
        }

        // TODO improve cache with someting LRU-like to save memory
        if (Math.random() > 0.9) {
            if (!lubCache.has(t1)) {
                lubCache.set(t1, new Map<TupleType, TupleType>());
            }
            lubCache.get(t1).set(t2, result);
        }
        return result;
    }

    depth--;
    return new CompleteLatticeImpl(top, bot, lub);
}

function box<T>(content?:T):Box<T> {
    return {content: content};
}

export enum ObjectTypeLatticeKinds {
    ObjectFieldEquality,
    ObjectFieldLubUnderSubtyping
}
export enum FunctionTypeLatticeKinds {
    FunctionIntersection,
    FunctionPointwiseLub
}
export enum MiscTypeLatticeKinds {
    UnionTypes
}

export function makeLatticeFromStrings(params:string[]):ValueTypeConfig {
    var objectLattice:ObjectTypeLatticeKinds;
    var functionLattice:FunctionTypeLatticeKinds;
    var miscLattices:MiscTypeLatticeKinds[] = [];
    for (var i = 0; i < params.length; i++) {
        var param = params[i];
        var objectTry = (<any>ObjectTypeLatticeKinds)[param];
        var functionTry = (<any>FunctionTypeLatticeKinds)[param];
        var miscTry = (<any>MiscTypeLatticeKinds)[param];

        if (objectTry !== undefined) {
            if (objectLattice) {
                throw new Error("ObjectTypeLatticeKind already specified: " + objectLattice);
            }
            objectLattice = objectTry;
        } else if (functionTry !== undefined) {
            if (functionLattice) {
                throw new Error("FunctionTypeLatticeKind already specified: " + functionLattice);
            }
            functionLattice = functionTry;
        } else if (miscTry !== undefined) {
            miscLattices.push(miscTry);
        } else {
            throw new Error("No such lattice configuration: " + param);
        }
    }
    return makeLatticeFromEnums(objectLattice, functionLattice, miscLattices);
}

export function makeLatticeFromEnums(objectLattice:ObjectTypeLatticeKinds, functionLattice:FunctionTypeLatticeKinds, misc:MiscTypeLatticeKinds[]):ValueTypeConfig {
    var multiKindsYieldsTop = misc.indexOf(MiscTypeLatticeKinds.UnionTypes) === -1;
    return makeLattice(objectLattice, functionLattice, multiKindsYieldsTop);
}

export function makeLattice(objectKind:ObjectTypeLatticeKinds, functionKind:FunctionTypeLatticeKinds, multiKindsYieldsTop:boolean, useSJSAscription:boolean = false):ValueTypeConfig {
    if (objectKind === undefined) {
        throw new Error("ObjectTypeLatticeKind not specified");
    }
    if (functionKind === undefined) {
        throw new Error("FunctionTypeLatticeKind not specified");
    }

    var top = TypeImpls.constants.Top;
    var bot = TypeImpls.constants.Bottom;
    var absentProperty = new TypeImpls.TupleTypeImpl([TypeImpls.constants.UndefinedTop]);

    function makeFieldEquality(functionLattice:Box<CompleteLattice<FunctionType>>):CompleteLattice<TupleType> {
        var propertyTypeLattice = new CompleteLatticeImpl(TypeImpls.constants.Top, TypeImpls.constants.Bottom, function (t1:TupleType, t2:TupleType):TupleType {
            if (TypeImpls.isTupleTypeEqual(t1, t2)) {
                return t1;
            } else {
                return TypeImpls.constants.Bottom;
            }
        });
        var objectLattice = makeObjectTypeLattice(box(propertyTypeLattice), functionLattice, useSJSAscription);
        var fullTypeLattice = makeFullTypeCrossProductLubLattice(box(objectLattice), multiKindsYieldsTop, false, useSJSAscription);
        return fullTypeLattice;
    }

    function makeFieldLubUnderSubtyping(functionLattice:Box<CompleteLattice<FunctionType>>):CompleteLattice<TupleType> {
        var objectBox = box<CompleteLattice<ObjectType>>();
        var fullTypeLattice = makeFullTypeCrossProductLubLattice(objectBox, multiKindsYieldsTop, false, useSJSAscription);
        var propertyTypeLattice = box<CompleteLattice<TupleType>>();
        objectBox.content = makeObjectTypeLattice(propertyTypeLattice, functionLattice, useSJSAscription);
        if (multiKindsYieldsTop) {
            propertyTypeLattice.content = makeFullTypeCrossProductObjectLubPrimitiveGlbLattice(objectBox);
        } else {
            propertyTypeLattice.content = fullTypeLattice;
        }
        return fullTypeLattice;
    }

    function makeFullTypeCrossProductObjectLubPrimitiveGlbLattice(objectLattice:Box<CompleteLattice<ObjectType>>):CompleteLattice<TupleType> {
        return makeFullTypeCrossProductLubLattice(objectLattice, false, true, useSJSAscription);
    }

    function makeFunctionIntersection(typeLatticeBox:Box<CompleteLattice<TupleType>>):CompleteLattice<FunctionType> {
        return makeFunctionIntersectionTypeLattice(typeLatticeBox, TypeImpls.constants.FunctionTop, TypeImpls.constants.FunctionBottom)
    }

    function makeFunctionPointwiseLub(typeLattice:Box<CompleteLattice<TupleType>>):CompleteLattice<FunctionType> {
        return makeFunctionPointwiseUnionTypeLattice(typeLattice, TypeImpls.constants.FunctionTop, TypeImpls.constants.FunctionBottom)
    }

    var functionLatticeBox = box<CompleteLattice<FunctionType>>();
    var typeLatticeBox = box<CompleteLattice<TupleType>>();
    var initialFunctionTypeMaker:MergeOperator<FunctionType>;
    switch (functionKind) {
        case FunctionTypeLatticeKinds.FunctionIntersection:
            functionLatticeBox.content = makeFunctionIntersection(typeLatticeBox);
            initialFunctionTypeMaker = function make(f1:FunctionType, f2:FunctionType):FunctionType {
                // TODO cleanup/change API in type inferencer?
                if (f1.functionKind === TypeImpls.FunctionKinds.Single && f2.functionKind === TypeImpls.FunctionKinds.Single) {
                    // normalize
                    var sf1 = <SingleFunctionType>f1;
                    return make(new TypeImpls.IntersectionFunctionTypeImpl([sf1]), f2);
                } else if (f1.functionKind === TypeImpls.FunctionKinds.Single && f2.functionKind === TypeImpls.FunctionKinds.Intersection) {
                    // normalize
                    return make(f2, f1);
                } else if (f2.functionKind === TypeImpls.FunctionKinds.Single && f1.functionKind === TypeImpls.FunctionKinds.Intersection) {
                    var intersection = <IntersectionFunctionType>f1;
                    var single = <SingleFunctionType>f2;
                    if (intersection.members.some(m => TypeImpls.isSingleFunctionTypeEqual(m, single))) {
                        return intersection; // already in the intersection...
                    }
                    var sameBaseAndArgument = intersection.members.filter(f2 => hasSameBaseAndArguments(single, f2));
                    var newMembers:SingleFunctionType[];
                    if (sameBaseAndArgument.length == 0) {
                        newMembers = intersection.members.concat([single])
                    } else if (sameBaseAndArgument.length == 1) {
                        var result = typeLatticeBox.content.lub(single.result, sameBaseAndArgument[0].result);
                        var callKinds = Misc.mergeFlatSets(sameBaseAndArgument[0].callKinds, single.callKinds); // TODO ensure these sets are equal?
                        var mergedResultFunction = new TypeImpls.SingleFunctionTypeImpl(single.base, single.args.slice(), result, callKinds);
                        newMembers = intersection.members.filter(m => sameBaseAndArgument[0] !== m /* remove the old with the same input */).concat([mergedResultFunction])
                    } else {
                        throw new Error("Multiple functions with same base and arguments?!")
                    }
                    return new TypeImpls.IntersectionFunctionTypeImpl(newMembers);
                } else {
                    throw new Error("Unexpected function types during initial function making: " + TypeImpls.functionToPrettyString(f1) + " and " + TypeImpls.functionToPrettyString(f2));
                }
            };
            break;
        case FunctionTypeLatticeKinds.FunctionPointwiseLub:
            var functionLattice = makeFunctionPointwiseLub(typeLatticeBox);
            functionLatticeBox.content = functionLattice;
            initialFunctionTypeMaker = functionLattice.lub;
            break;
        default:
            throw new Error("Unhandled kind: " + functionKind);
    }

    switch (objectKind) {
        case ObjectTypeLatticeKinds.ObjectFieldEquality:
            typeLatticeBox.content = makeFieldEquality(functionLatticeBox);
            break;
        case ObjectTypeLatticeKinds.ObjectFieldLubUnderSubtyping:
            typeLatticeBox.content = makeFieldLubUnderSubtyping(functionLatticeBox);
            break;
        default:
            throw new Error("Unhandled kind: " + functionKind);
    }
    return {
        types: typeLatticeBox.content,
        initialFunctionTypeMaker: initialFunctionTypeMaker,
        useSJSAscription: useSJSAscription
    };
}

export function makeFullIntersection(functionLatticeKind:FunctionTypeLatticeKinds = FunctionTypeLatticeKinds.FunctionIntersection):ValueTypeConfig {
    return makeLattice(ObjectTypeLatticeKinds.ObjectFieldEquality, functionLatticeKind, true);
}

export function makeSimpleSubtyping(functionLatticeKind:FunctionTypeLatticeKinds = FunctionTypeLatticeKinds.FunctionIntersection):ValueTypeConfig {
    return makeLattice(ObjectTypeLatticeKinds.ObjectFieldLubUnderSubtyping, functionLatticeKind, true);
}

export function makeSimpleSubtypingWithUnion(functionLatticeKind:FunctionTypeLatticeKinds = FunctionTypeLatticeKinds.FunctionIntersection):ValueTypeConfig {
    return makeLattice(ObjectTypeLatticeKinds.ObjectFieldLubUnderSubtyping, functionLatticeKind, false);
}

export function makeSJS(functionLatticeKind:FunctionTypeLatticeKinds = FunctionTypeLatticeKinds.FunctionIntersection):ValueTypeConfig {
    return makeLattice(ObjectTypeLatticeKinds.ObjectFieldLubUnderSubtyping, functionLatticeKind, true, true);
}
