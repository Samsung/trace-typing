///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../src/types.d.ts"/>

import assert = require("assert");
import TypeInferencer = require("../src/typing/TypeInferencer");
import TypeLattices = require("../src/typing/TypeLattices");
import TypeImpls = require("../src/typing/TypeImpls");
import AST = require("../src/TraceLanguageAST");
import TraceMaker = require('../src/TraceMaker');
import TraceReplayer = require('../src/trace-replaying/TraceReplayer');
import Misc = require('../src/Misc');
import SJS = require('../src/SJS');

var None = Misc.None;
var Some = Misc.Some;

function unsupported():any {
    throw new Error("Operation not supported for testing...");
}
interface Properties {
    [s:string]:Value
}
class PrimitiveTestImpl implements Primitive {
    valueKind = AST.ValueKinds.Primitive;

    constructor(public primitiveKind:AST.PrimitiveKind) {
    }
}
var number:Primitive = new PrimitiveTestImpl(AST.PrimitiveKind.Number);
var string:Primitive = new PrimitiveTestImpl(AST.PrimitiveKind.String);
var boolean:Primitive = new PrimitiveTestImpl(AST.PrimitiveKind.Boolean);
var undef:Primitive = new PrimitiveTestImpl(AST.PrimitiveKind.Undefined);
class Inst implements Instance {
    valueKind = AST.ValueKinds.Object;
    shapes:Shape[];
    functionUsages:DynamicFunctionSignature[] = [];

    constructor(public properties:Properties) {
        this.shapes = [new Shp(properties)];

    }
}
class Shp implements Shape {
    traceIndex = 0;
    meta:TraceElementMetaInformation = undefined;

    constructor(private properties:any) {

    }

    addInitialProperty(propertyName:string, propertyValue:Value) {
        return unsupported();
    }

    getPrototypeObject():Value {
        return {valueKind: AST.ValueKinds.Primitive, primitiveKind: AST.PrimitiveKind.Null};
    }

    getPropertyNames():string[] {
        return Object.getOwnPropertyNames(this.properties);
    }

    hasProperty(name:string):boolean {
        return Object.prototype.hasOwnProperty.call(this.properties, name);
    }

    getPropertyValue(name:string):Value {
        return this.properties[name];
    }

    getObjectClassification():number {
        throw new Error("Not implemented");
    }

    hasObjectClassification():boolean {
        return false;
    }

    getIsDotPrototype():boolean {
        return false;
    }
}
class DynFunSig implements DynamicFunctionSignature {
    public function:Instance = undefined;
    public base:Instance;
    public args:Value[];
    public result:Value;
    public meta:TraceElementMetaInformation = undefined;
    public callTraceIndex = 0;
    public returnTraceIndex = 0;
    public isConstructorCall = false;

    constructor(base:Instance, args:Value[], result:Value, fun?:Instance) {
        this.base = base;
        this.args = args;
        this.result = result;
        this.function = fun;
    }
}

class ArgResDynFunSig implements DynamicFunctionSignature {
    public function:Instance;
    public base = new Inst({});
    public meta:any = undefined;
    public callTraceIndex:any = undefined;
    public returnTraceIndex:any = undefined;
    public isConstructorCall = false;

    constructor(public args:Value[], public result:Value, fun?:Instance) {
        this.function = fun;
        if (fun) {
            fun.functionUsages.push(<DynamicFunctionSignature>this);
        }
    }
}

class ObjT implements ObjectType {
    public typeKind = TypeImpls.TypeKinds.Object;
    public objectKind = TypeImpls.ObjectKinds.Some;
    public objectClassification = new TypeImpls.ObjectClassificationTypeImpl(new Set<SJS.ObjectClassification>());
    public readOnlyPropertyNames = new Set<string>();
    public MRO:Map<string, TupleType> = undefined;
    public MRW:Map<string, TupleType> = undefined;
    public isAbstract:boolean = false;

    constructor(public properties:PropertyTypes, public functionType:FunctionType = TypeImpls.constants.FunctionBottom) {
    }
}

class SFunT implements SingleFunctionType {
    public functionKind = TypeImpls.FunctionKinds.Single;
    public callKinds = new Set<number>();

    constructor(public base:TupleType, public args:TupleType[], public result:TupleType) {
    }
}
class IFunT implements IntersectionFunctionType {
    public functionKind = TypeImpls.FunctionKinds.Intersection;

    constructor(public members:SingleFunctionType[]) {
    }
}
var numberT:Type = TypeImpls.constants.NumberTop;
var stringT:Type = TypeImpls.constants.StringTop;
var booleanT:Type = TypeImpls.constants.BooleanTop;
var topObjT:Type = TypeImpls.constants.ObjectTop;
var undefT:Type = TypeImpls.constants.UndefinedTop;
var topT:TupleType = TypeImpls.constants.Top;
var botT:TupleType = TypeImpls.constants.Bottom;

function mkInferencer() {

    var fullIntersection = TypeLattices.makeFullIntersection();
    var simpleSubtyping = TypeLattices.makeSimpleSubtyping();
    var simpleSubtypingWithUnion = TypeLattices.makeSimpleSubtypingWithUnion();
    return {
        inferIntersection: (es:Instance[]) => new TypeInferencer.TypeInferencerImpl(fullIntersection.types, fullIntersection.initialFunctionTypeMaker).inferObjectType(es, []),
        inferSimpleSubtyping: (es:Instance[]) => new TypeInferencer.TypeInferencerImpl(simpleSubtyping.types, simpleSubtyping.initialFunctionTypeMaker).inferObjectType(es, []),
        inferSimpleSubtypingWithUnion: (es:Instance[]) => new TypeInferencer.TypeInferencerImpl(simpleSubtypingWithUnion.types, simpleSubtypingWithUnion.initialFunctionTypeMaker).inferObjectType(es, [])
    }
}
function mkAscriber() {
    var fullIntersection = TypeLattices.makeFullIntersection();
    return new TypeInferencer.TypeInferencerImpl(fullIntersection.types, fullIntersection.initialFunctionTypeMaker).getAscriber()
}

function testAscribePrimitiveType(concrete:Primitive, type:Type) {
    assert.deepEqual(mkAscriber().ascribeType(concrete, []), _(type));
}
function testAscribeFunctionType(sig:DynamicFunctionSignature, type:FunctionType) {
    assert.deepEqual(mkAscriber().ascribeFunctionType(sig, []), type);
}
function testAscribeObjectType(concrete:Instance, type:ObjT) {
    var ascriber = mkAscriber();
    // we need to do deep equality checks, but the test frameworks do not support that for recursive objects..
    // fallback to to-string comparisons
    var ascribedType = ascriber.ascribeType(concrete, []);
    var actual = TypeImpls.toPrettyString(ascribedType, true);
    var expected = TypeImpls.toPrettyString(_(type), true);
    assert.equal(actual, expected);
}
function testInferIntersectionObjectType(concretes:Instance[], type:ObjT) {
    assert.deepEqual(mkInferencer().inferIntersection(concretes), type);
}
function testInferSimpleSubtyping(concretes:Instance[], type:ObjT) {
    assert.deepEqual(mkInferencer().inferSimpleSubtyping(concretes), type);
}
function testInferSimpleSubtypingWithUnion(concretes:Instance[], type:ObjT) {
    assert.deepEqual(mkInferencer().inferSimpleSubtypingWithUnion(concretes), type);
}

function _<T extends Type>(...ts:T[]):TupleType {
    return new TypeImpls.TupleTypeImpl(ts);
}
function testInferFullIntersectionFunctionType(partialSigs:ArgResDynFunSig[], type:FunctionType) {
    var o = new Inst({});
    var sigs:DynFunSig[] = partialSigs.map(sig => {
        var instance = sig.function ? sig.function : o;
        var fullSig = new DynFunSig(instance, sig.args, sig.result, instance);
        fullSig.function.functionUsages.push(fullSig);
        return fullSig;
    });
    var t:ObjectType = mkInferencer().inferIntersection([o]);
    if (TypeImpls.TupleAccess.isFunction(_(t))) {
        assert.equal(TypeImpls.functionToPrettyString(TypeImpls.TupleAccess.getFunction(_(t))), TypeImpls.functionToPrettyString(type));
    } else {
        assert.equal(undefined, type);
    }
}

describe("TypeInference unit tests", function () {
    function setProp(base:ObjectType, propertyName:string, value:TupleType) {
        base.properties[propertyName] = value;
    }

    function getObjProp(base:ObjectType, propertyName:string):ObjectType {
        var property = base.properties[propertyName];
        return TypeImpls.TupleAccess.getObject(property);
    }

    describe("TypeAscriber", function () {
        describe(".ascribePrimitiveType", function () {
            it("Should ascribe misc.", function () {
                testAscribePrimitiveType({
                    valueKind: AST.ValueKinds.Primitive,
                    primitiveKind: AST.PrimitiveKind.Number
                }, numberT);
                testAscribePrimitiveType({
                    valueKind: AST.ValueKinds.Primitive,
                    primitiveKind: AST.PrimitiveKind.String
                }, stringT);
                testAscribePrimitiveType({
                    valueKind: AST.ValueKinds.Primitive,
                    primitiveKind: AST.PrimitiveKind.Boolean
                }, booleanT);
            });
        });
        describe(".ascribeObjectType", function () {
            it("Should ascribe empty object", function () {
                testAscribeObjectType(new Inst({}), new ObjT({}));
            });
            it("Should ascribe unnested objects", function () {
                testAscribeObjectType(
                    new Inst({x: number}),
                    new ObjT({x: _(numberT)}));
                testAscribeObjectType(
                    new Inst({x: number, y: string}),
                    new ObjT({x: _(numberT), y: _(stringT)}));
                testAscribeObjectType(
                    new Inst({x: number, y: string, z: boolean}),
                    new ObjT({x: _(numberT), y: _(stringT), z: _(booleanT)})
                );
            });
            it("Should ascribe nested objects", function () {
                testAscribeObjectType(
                    new Inst({x: new Inst({})}),
                    new ObjT({x: _(new ObjT({}))}));
                testAscribeObjectType(
                    new Inst({x: new Inst({y: string})}),
                    new ObjT({x: _(new ObjT({y: _(stringT)}))}));
            });
            it("should ascribe self-recursive objects", function () {
                // top-level
                var o1a = new Inst({});
                (<any>o1a.properties).a = o1a;
                var recType1 = new ObjT({a: undefined});
                setProp(recType1, 'a', _(recType1));
                testAscribeObjectType(o1a, recType1);

                //// non-top-level
                var o2a = new Inst({});
                (<any>o2a.properties).a = o2a;
                var recType2 = new ObjT({a: undefined});
                setProp(recType2, 'a', _(recType2));
                testAscribeObjectType(new Inst({t: o2a}), new ObjT({t: _(recType2)}));
            });
            it("should ascribe mutual-recursive objects", function () {
                // top-level
                var o1a = new Inst({});
                var o1b = new Inst({a: o1a});
                (<any>o1a.properties).b = o1b;
                var recType1 = new ObjT({b: _(new ObjT({a: undefined}))});
                setProp(getObjProp(recType1, 'b'), 'a', _(recType1));
                testAscribeObjectType(o1a, recType1);

                // non-top-level
                var o2a = new Inst({});
                var o2b = new Inst({a: o2a});
                (<any>o2a.properties).b = o2b;
                var recType2 = new ObjT({b: _(new ObjT({a: undefined}))});
                setProp(getObjProp(recType2, 'b'), 'a', _(recType2));
                testAscribeObjectType(new Inst({t: o2a}), new ObjT({t: _(recType2)}));

                // indirect
                var o3a = new Inst({});
                var o3b = new Inst({a: o3a});
                var o3c = new Inst({b: o3b});
                (<any>o3a.properties).c = o3c;
                var recType3 = new ObjT({c: _(new ObjT({b: _(new ObjT({a: undefined}))}))});
                setProp(getObjProp(getObjProp(recType3, 'c'), 'b'), 'a', _(recType3));
                testAscribeObjectType(o3a, recType3);
            });
            it("should ascribe multiple recursive objects", function () {
                var o1a = new Inst({});
                (<any>o1a.properties).a = o1a;
                var o1b = new Inst({});
                (<any>o1b.properties).b = o1b;
                var recType1a = new ObjT({a: undefined});
                var recType1b = new ObjT({b: undefined});
                setProp(recType1a, 'a', _(recType1a));
                setProp(recType1b, 'b', _(recType1b));
                testAscribeObjectType(new Inst({pa: o1a, pb: o1b}), new ObjT({
                    pa: _(recType1a),
                    pb: _(recType1b)
                }));
            });
        });
        describe(".ascribeFunctionType", function () {
            it("Should ascribe primitives", function () {
                testAscribeFunctionType(new DynFunSig(new Inst({}), [], undef), new SFunT(_(new ObjT({})), [], _(undefT)));
                testAscribeFunctionType(new DynFunSig(new Inst({}), [], number), new SFunT(_(new ObjT({})), [], _(numberT)));
                testAscribeFunctionType(new DynFunSig(new Inst({}), [number, string], boolean), new SFunT(_(new ObjT({})), [_(numberT), _(stringT)], _(booleanT)));
            });
            it("Should ascribe objects", function () { // NB: ONLY single function sigs here, otherwise merges are required!
                testAscribeFunctionType(new DynFunSig(new Inst({}), [], new Inst({x: number})), new SFunT(_(new ObjT({})), [], _(new ObjT({x: _(numberT)}))));
                testAscribeFunctionType(new DynFunSig(new Inst({}), [new Inst({x: number})], undef), new SFunT(_(new ObjT({})), [_(new ObjT({x: _(numberT)}))], _(undefT)));
            });
        });
    });
    describe("TypeInferencer without functions", function () {

        describe(".inferIntersectionObjectType", function () {
            it("Should infer on single empty object", function () {
                testInferIntersectionObjectType(
                    [new Inst({})],
                    new ObjT({}));
            });
            it("Should infer on multiple empty objects", function () {
                testInferIntersectionObjectType(
                    [new Inst({}), new Inst({})],
                    new ObjT({}));
            });
            it("Should infer on multiple unnested objects", function () {
                testInferIntersectionObjectType(
                    [new Inst({x: number}), new Inst({x: number})],
                    new ObjT({x: _(numberT)})); // same propvalue
                testInferIntersectionObjectType(
                    [new Inst({x: number}), new Inst({x: string})],
                    new ObjT({})); // different propvalue
                testInferIntersectionObjectType(
                    [new Inst({x: number}), new Inst({y: number})],
                    new ObjT({})); // different prop
                testInferIntersectionObjectType(
                    [new Inst({x: number, y: string}), new Inst({x: number, y: number, z: boolean})],
                    new ObjT({x: _(numberT)}));
            });
            it("Should infer on multiple nested objects", function () {
                testInferIntersectionObjectType(
                    [new Inst({x: new Inst({y: number})}), new Inst({x: new Inst({y: number})})],
                    new ObjT({x: _(new ObjT({y: _(numberT)}))})); // same propvalue
                testInferIntersectionObjectType(
                    [new Inst({x: new Inst({y: number})}), new Inst({x: new Inst({y: string})})],
                    new ObjT({})); // different propvalue
                testInferIntersectionObjectType(
                    [new Inst({x: new Inst({z: number})}), new Inst({y: new Inst({z: number})})],
                    new ObjT({})); // different prop
                testInferIntersectionObjectType([
                    new Inst({x: new Inst({y: number}), y: new Inst({y: string})}),
                    new Inst({x: new Inst({y: number}), y: new Inst({y: number}), z: new Inst({y: boolean})})
                ], new ObjT({x: _(new ObjT({y: _(numberT)}))}));
            });
        });

        describe(".inferSimpleSubtyping", function () {
            it("Should infer on single empty object", function () {
                testInferSimpleSubtyping(
                    [new Inst({})],
                    new ObjT({}));
            });
            it("Should infer on multiple empty objects", function () {
                testInferSimpleSubtyping(
                    [new Inst({}), new Inst({})],
                    new ObjT({}));
            });
            it("Should infer on multiple unnested objects", function () {
                testInferSimpleSubtyping(
                    [new Inst({x: number}), new Inst({x: number})],
                    new ObjT({x: _(numberT)})); // same propvalue
                testInferSimpleSubtyping(
                    [new Inst({x: number}), new Inst({x: string})],
                    new ObjT({})); // different propvalue
                testInferSimpleSubtyping(
                    [new Inst({x: number}), new Inst({y: number})],
                    new ObjT({})); // different prop
                testInferSimpleSubtyping([
                        new Inst({x: number, y: string}),
                        new Inst({x: number, y: number, z: boolean})
                    ],
                    new ObjT({
                        x: _(numberT)
                    }));
            });
            it("Should infer on multiple nested objects", function () {
                testInferSimpleSubtyping([
                    new Inst({x: new Inst({y: number})}),
                    new Inst({x: new Inst({y: number})})
                ], new ObjT({x: _(new ObjT({y: _(numberT)}))})); // same propvalue
                testInferSimpleSubtyping([
                    new Inst({x: new Inst({y: number})}),
                    new Inst({x: new Inst({y: string})})
                ], new ObjT({x: _(new ObjT({}))})); // different propvalue
                testInferSimpleSubtyping([
                    new Inst({x: new Inst({z: number})}),
                    new Inst({y: new Inst({z: number})})
                ], new ObjT({})); // different prop
                testInferSimpleSubtyping([
                        new Inst({
                            x: number,
                            y: new Inst({y: string})
                        }),
                        new Inst({
                            x: new Inst({y: number}),
                            y: new Inst({y: number}),
                            z: new Inst({y: boolean})
                        })
                    ],
                    new ObjT({
                        y: _(new ObjT({}))
                    }));
            });
        });

        describe(".inferSimpleSubtypingWithUnion", function () {
            function orUndef(t:Type):TupleType {
                return _(t, undefT);
            }

            it("Should infer on single empty object", function () {
                testInferSimpleSubtypingWithUnion(
                    [new Inst({})],
                    new ObjT({}));
            });
            it("Should infer on multiple empty objects", function () {
                testInferSimpleSubtypingWithUnion(
                    [new Inst({}), new Inst({})],
                    new ObjT({}));
            });
            it("Should infer on multiple unnested objects", function () {
                testInferSimpleSubtypingWithUnion(
                    [new Inst({x: number}), new Inst({x: number})],
                    new ObjT({x: _(numberT)})); // same propvalue
                testInferSimpleSubtypingWithUnion(
                    [new Inst({x: number}), new Inst({x: string})],
                    new ObjT({x: _(numberT, stringT)})); // different propvalue
                testInferSimpleSubtypingWithUnion(
                    [new Inst({x: number}), new Inst({y: number})],
                    new ObjT({})); // different prop
                testInferSimpleSubtypingWithUnion([
                        new Inst({x: number, y: string}),
                        new Inst({x: number, y: number, z: boolean})
                    ],
                    new ObjT({
                        x: _(numberT), y: _(numberT, stringT)
                    }));
            });
            it("Should infer on multiple nested objects", function () {
                testInferSimpleSubtypingWithUnion([
                    new Inst({x: new Inst({y: number})}),
                    new Inst({x: new Inst({y: number})})
                ], new ObjT({x: _(new ObjT({y: _(numberT)}))})); // same propvalue
                testInferSimpleSubtypingWithUnion([
                    new Inst({x: new Inst({y: number})}),
                    new Inst({x: new Inst({y: string})})
                ], new ObjT({x: _(new ObjT({y: _(numberT, stringT)}))})); // different propvalue
                testInferSimpleSubtypingWithUnion([
                    new Inst({x: new Inst({z: number})}),
                    new Inst({y: new Inst({z: number})})
                ], new ObjT({})); // different prop
                testInferSimpleSubtypingWithUnion([
                        new Inst({
                            x: number,
                            y: new Inst({y: string})
                        }),
                        new Inst({
                            x: new Inst({y: number}),
                            y: new Inst({y: number}),
                            z: new Inst({y: boolean})
                        })
                    ],
                    new ObjT({
                        x: _(numberT, new ObjT({y: _(numberT)})),
                        y: _(new ObjT({y: _(numberT, stringT)}))
                    }));
            });
        });

        describe("Source code that approximate the previous test cases", function () {
            it("should be replayable without crashing", function (done) {
                TraceMaker.getTraceFromSourceFile("test/fixtures/objectMergeStrategyShowcasing.js", function (e, trace) {
                    if (e) {
                        done(e);
                        return;
                    }
                    TraceReplayer.replayTrace(trace);
                    done();
                });
            });
        })


    });
});

