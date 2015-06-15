///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../src/types.d.ts"/>

import assert = require("assert");
import path = require("path");

import Misc = require("../src/Misc")
import TraceImporter = require("../src/TraceImporter")
import TraceMaker = require("../src/TraceMaker");
import TypeInferencer = require("../src/typing/TypeInferencer");
import TypeLattices = require("../src/typing/TypeLattices");
import TypeImpls = require("../src/typing/TypeImpls");
import MetaInformationExplainerImpl = require("../src/MetaInformationExplainer");
import VariableManager = require("../src/VariableManager");
import TraceReplayer = require("../src/trace-replaying/TraceReplayer");
import TypedTraceReplayer = require("../src/trace-replaying/TypedTraceReplayer");

import maker = require("../src/TraceMaker");

function tuplify<T extends Type>(...ts:T[]):TupleType {
    return new TypeImpls.TupleTypeImpl(ts);
}

var _number:Type;
var _string:Type;
var _undefined:Type;

var bot:TupleType;
var top:TupleType;

var Number:TupleType;
var Undefined:TupleType;
var String:TupleType;
var NumberString:TupleType;
var ONumber:TupleType;
var ONumberString:TupleType;
var OString:TupleType;
var ObjTop:TupleType;

interface InferencerConfig {
    (): ValueTypeConfig
}

var inferenceConfigs = (function () {
    return {
        fullIntersection():ValueTypeConfig {
            return TypeLattices.makeFullIntersection();
        },
        simpleSubtypingWithUnion():ValueTypeConfig {
            return TypeLattices.makeSimpleSubtypingWithUnion();
        },
        simpleSubtyping():ValueTypeConfig {
            return TypeLattices.makeSimpleSubtyping();
        }

    };
})();
var precisionConfigs = {
    full: {
        flowInsensitiveVariables: false,
        contextInsensitiveVariables: false
    },
    flowInsensitive: {
        flowInsensitiveVariables: true,
        contextInsensitiveVariables: false
    },
    contextInsensitive: {
        flowInsensitiveVariables: false,
        contextInsensitiveVariables: true
    },
    none: {
        flowInsensitiveVariables: true,
        contextInsensitiveVariables: true
    }
};
/**
 * Test runner: the source should assign the value to be checked to `RESULT`
 */
function test(source:string, callback:(type:TupleType)=>void, inferencerConfig:InferencerConfig, precisionConfig:PrecisionConfig, done:Function) {
    source = "(function(RESULT){" + source + "})();";
    TraceMaker.getTraceFromSource(source, function (err:any, trace:Trace) {
        if (err) {
            done(err);
            throw err;
        }
        try {
            var traceReplayResults = TraceReplayer.replayTrace(trace);
            var typeLatticePair = inferencerConfig();

            var results = TypedTraceReplayer.replayTrace(traceReplayResults.variableValues, traceReplayResults.variableList, trace.statements, precisionConfig, typeLatticePair);
            var resultVariables = traceReplayResults.variableList.filter((v:Variable) => v.name === 'RESULT');
            var resultVariable = resultVariables[0];
            callback(results.propagatedEnv.read(resultVariable));
            done();
        } catch (e) {
            done(e);
            throw e;
        }
    });
}
var dataFlows = "var a = {p: 42}; function f(o){return o.p;} RESULT = f(a);";
function testFile(sourceFile:string, config:InferencerConfig, precisionConfig:PrecisionConfig, done:Function) {
    TraceMaker.getTraceFromSourceFile(sourceFile, function (err:any, trace:Trace) {
        if (err) {
            done(err);
            throw err;
        }
        try {
            var traceReplayResults = TraceReplayer.replayTrace(trace);
            var typeLatticePair = config();

            TypedTraceReplayer.replayTrace(traceReplayResults.variableValues, traceReplayResults.variableList, trace.statements, precisionConfig, typeLatticePair);
            done();
        } catch (e) {
            done(e);
            throw e;
        }
    });
}
describe("TypedTraceReplayer", function () {
    beforeEach(function () {
        _number = TypeImpls.constants.NumberTop;
        _string = TypeImpls.constants.StringTop;
        _undefined = TypeImpls.constants.UndefinedTop;

        bot = TypeImpls.constants.Bottom;
        top = TypeImpls.constants.Top;

        Number = tuplify(_number);
        Undefined = tuplify(_undefined);
        String = tuplify(_string);
        NumberString = tuplify(_string, _number);
        ONumber = tuplify(_undefined, _number);
        OString = tuplify(_undefined, _string);
        ONumberString = tuplify(_undefined, _string, _number);
        ObjTop = tuplify(TypeImpls.constants.ObjectTop);

    });
    var precisionConfig = precisionConfigs.full;

    describe("Trivials", function () {
        it('Should work for data flows', function (done) {
            test(dataFlows, function (type:TupleType) {
                    assert.deepEqual(type, Number);
                }, inferenceConfigs.fullIntersection, precisionConfig, done
            );
        });
        it('Should work for constants', function (done) {
            test("RESULT = 0;", function (type:TupleType) {
                assert.deepEqual(type, Number);
            }, inferenceConfigs.fullIntersection, precisionConfig, done);
        });
        it('Should work for properties', function (done) {
            test("RESULT = NaN;" /* property of the global object!*/, function (type:TupleType) {
                assert.deepEqual(type, Number);
            }, inferenceConfigs.fullIntersection, precisionConfig, done);
        });
    });
    describe("prototype mutations", function () {
        it('Should allow method invocation on prototype after object-coercion', function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {flowInsensitiveVariables: true};
            test("" +
                "String.prototype.f = function () {};" +
                "'foo'.f();", function () {
                },
                config, flowConfig, done);
        });
        it('Should allow method invocation on prototype after object-coercion', function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {flowInsensitiveVariables: true};
            test("" +
                "String.prototype.f = function () {};" +
                "'foo'.f();", function () {
                },
                config, flowConfig, done);
        });
    });
    describe("Infinite recursion during type inference", function () {
        this.timeout(10 * 1000);
        it('Should be able to perform precise merge of cyclic, isomorphic objects', function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {flowInsensitiveVariables: true};
            test("" +
                "(function(){" +
                "   var a = {x: 42}; var b = {x: 42}; var c = {x: 42}; var d = {x: 42};" +
                "   a.p1 = b; b.p2 = a; c.p1 = d; d.p2 = c;" +
                "   var v = a; v = c; RESULT = a.p1.p2.x;" +
                "})();", function (type:TupleType) {
                    assert.deepEqual(type, ONumber);
                },
                config, flowConfig, done);
        });
        it('Should handle merge of cyclic, partly isomorphic objects with intersection', function (done) {
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {flowInsensitiveVariables: true};
            test("" +
                "(function(){" +
                "   var a = {}; var b = {}; var c = {}; var d = {};" +
                "   a.p1 = b; b.p2 = a; c.p1 = d; d.p2 = c;" +
                "   a.p3 = 42; a.p4 = 'foo'; c.p5 = 'xxx'; c.p3 = true; c.p4 = 'bar';" +
                "   var v = a; v = c; RESULT = v.p1.p2.p5;" +
                "})();", function (type:TupleType) {
                    assert.deepEqual(type, OString /* due to bot, and default variable value */);
                },
                config, flowConfig, done);
        });
        it('Should be able to perform merge of cyclic, partly isomorphic objects', function (done) {
            var config = inferenceConfigs.simpleSubtyping;
            var flowConfig = {flowInsensitiveVariables: true};
            test("" +
                "(function(){" +
                "   var a = {}; var b = {}; var c = {}; var d = {};" +
                "   a.p1 = b; b.p2 = a; c.p1 = d; d.p2 = c;" +
                "   a.p3 = 42; a.p4 = 'foo'; c.p5 = 'xxx'; c.p3 = true; c.p4 = 'bar';" +
                "   var v = a; v = c;" +
                "})();", function (type:TupleType) {
                    // termination is sufficient
                },
                config, flowConfig, done);
        });
        it.skip('Should not be able to perform precise union merge of cyclic, partly isomorphic objects', function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {flowInsensitiveVariables: true};
            test("" +
                "(function(){" +
                "   var a = {}; var b = {}; var c = {}; var d = {};" +
                "   a.p1 = b; b.p2 = a; c.p1 = d; d.p2 = c;" +
                "   a.p3 = 42; a.p4 = 'foo'; c.p5 = 'xxx'; c.p3 = true; c.p4 = 'bar';" +
                "   var v = a; v = c;" +
                "})();", function (type:TupleType) {
                    // termination is sufficient
                },
                config, flowConfig, done);
        });
    });

    describe("Regression for bugs", function () {
        this.timeout(10 * 1000);
        it('Should handle new Date().getDay() bug', function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {flowInsensitiveVariables: true};
            test("var day=new Date().getDay();var x = day === 5? 'x': 'y';", function () {
                },
                config, flowConfig, done);
        });
        it("Should handle .toString and .join", function (done) {
            // (bug was a bad canonicalization that did not respect the base of a call)
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {flowInsensitiveVariables: true};
            test("({}.toString()); [].join();", function () {
                },
                config, flowConfig, done);
        });
        it("Should handle lazy.js prototype hierarchy", function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {};
            testFile("test/fixtures/lazy.js_minimal-prototype-bug.js",
                config, flowConfig, done);
        });
        it("Should handle lodash overloading", function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {};
            testFile("test/fixtures/lodash_minimal-merge-bug.js",
                config, flowConfig, done);
        });
        it("Should handle recursive function types", function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {};
            testFile("test/fixtures/recursive_function_types.js",
                config, flowConfig, done);
        });
        it("Should handle recursive function calls & object references", function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {flowInsensitiveVariables: true};
            testFile("test/fixtures/missing_object_type.js",
                config, flowConfig, done);
        });
        it("Should handle two invocations of RegExp.test()", function (done) {
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {};
            test("var r = RegExp(); r.test();r.test();", function () {
                },
                config, flowConfig, done);
        });
        it("Should handle two invocations of RegExp().test() with different arguments;", function (done) {
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {};
            test("RegExp().test();RegExp().test();", function () {
                },
                config, flowConfig, done);
        });
        it("Should handle two invocations of RegExp().test()", function (done) {
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {};
            test("RegExp().test();RegExp().test();", function () {
                },
                config, flowConfig, done);
        });
        it("Should handle five invocations of RegExp().test()", function (done) {
            // very weird bug
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {};
            test("RegExp().test();RegExp().test();RegExp().test();RegExp().test();RegExp().test();", function () {
                },
                config, flowConfig, done);
        });
        it("Should handle five invocations of toString()", function (done) {
            // very weird bug
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {};
            test("toString();toString();toString();toString();toString();", function () {
                },
                config, flowConfig, done);
        });
        it("Should handle five invocations of ({}).toString()", function (done) {
            // very weird bug
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {};
            test("({}).toString();({}).toString();({}).toString();({}).toString();({}).toString();", function () {
                },
                config, flowConfig, done);
        });
        it("Non-monotonicity bug", function (done) {
            var config = inferenceConfigs.simpleSubtypingWithUnion;
            var flowConfig = {flowInsensitiveVariables: true};
            test('(function () {' +
                '    Object;' +
                '    Function;' +
                '    var v = {};' +
                '    v = function () {' +
                '    };' +
                '})();', function () {
                },
                config, flowConfig, done
            );
        });
    });
    describe("Object allocations", function () {
        var config = inferenceConfigs.fullIntersection;
        var precisionConfig = precisionConfigs.full;

        it('Should work for data flows', function (done) {
            test(dataFlows, function (type:TupleType) {
                assert.deepEqual(type, Number);
            }, config, precisionConfig, done);
        });
        it('Should work for precision losses', function (done) {
            test("var o = {p: 42}; o.p = 'foo'; RESULT =  o.p;", function (type:TupleType) {
                assert.deepEqual(type, top);
            }, config, precisionConfig, done);
        });
        it('Should work for dereferences', function (done) {
            test("var o = {p1: {p2: 42}}; RESULT =  o.p1.p2;", function (type:TupleType) {
                assert.deepEqual(type, Number);
            }, config, precisionConfig, done);
        });
        it('Should work for imprecision in nested property', function (done) {
            test("var o = {p1: {p2: 42}}; o.p1.p2 = 'foo'; RESULT = o.p1.p2;", function (type:TupleType) {
                assert.deepEqual(type, top);
            }, config, precisionConfig, done);
        });
        it('Should work for multiple objects in same property', function (done) {
            test("var o = {p1: {p2: 42}}; o.p1 = {p2: 'foo'}; RESULT = o.p1.p2", function (type:TupleType) {
                assert.deepEqual(type, String /* materialized after type error*/);
            }, config, precisionConfig, done);
        });
        it('Should work for arrays', function (done) {
            test("RESULT = [42][0];", function (type:TupleType) {
                assert.deepEqual(type, ONumber);
            }, config, precisionConfig, done);
        });
        it('Should work for nested arrays', function (done) {
            test("RESULT = [[42]][0][0];", function (type:TupleType) {
                assert.deepEqual(type, ONumber);
            }, config, precisionConfig, done);
        });
    });
    describe.skip("Getters & setters", function () {
        var config = inferenceConfigs.fullIntersection;
        var precisionConfig = precisionConfigs.full;
        this.timeout(5 * 1000);
        it("Should handle defined setters", function (done) {
            test("var o = {}; Object.defineProperty(o, 'p', {set: function(v){this._p  = v;}}); o.p = 42; RESULT = o._p;", function (type:TupleType) {
                assert.deepEqual(type, ONumber);
            }, config, precisionConfig, done);
        });
        it("Should handle defined getters", function (done) {
            test("var o = {_p: 42}; Object.defineProperty(o, 'p', {get: function(v){return this._p;}}); RESULT = o.p;", function (type:TupleType) {
                assert.deepEqual(type, Number);
            }, config, precisionConfig, done);
        });
    });
    describe("Prototypes", function () {
        var config = inferenceConfigs.simpleSubtypingWithUnion;
        var precisionConfig = precisionConfigs.full;

        it('Should handle no prototype usage #1', function (done) {
            test('RESULT = ({p: "foo"}).p', function (type:TupleType) {
                assert.deepEqual(type, String);
            }, config, precisionConfig, done);
        });
        it('Should handle no prototype usage #2', function (done) {
            test('var o = {}; o.p = "foo"; RESULT = o.p;', function (type:TupleType) {
                assert.deepEqual(type, OString);
            }, config, precisionConfig, done);
        });
        it('Should handle no prototype usage #3', function (done) {
            test('var o = {}; RESULT = o.p;', function (type:TupleType) {
                assert.deepEqual(type, Undefined);
            }, config, precisionConfig, done);
        });
        it('Should handle prototype usage', function (done) {
            test('Object.prototype.p = "foo"; var o = {}; RESULT = o.p;', function (type:TupleType) {
                assert.deepEqual(type, OString);
            }, config, precisionConfig, done);
        });
        it('Should handle shadowed prototype usage', function (done) {
            test('Object.prototype.p = "foo"; var o = {p: 42}; RESULT = o.p;', function (type:TupleType) {
                assert.deepEqual(type, Number);
            }, config, precisionConfig, done);
        });
        it('Should handle maybe shadowed prototype usage', function (done) {
            test('Object.prototype.p = "foo"; var o = {}; o.p = 42; RESULT = o.p;', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
    });
    describe("Arrays", function () {
        var config = inferenceConfigs.simpleSubtypingWithUnion;
        var precisionConfig = precisionConfigs.full;

        it('concatPrimitive_Access0', function (done) {
            test('var a = ["foo"]; b = a.concat(34); RESULT = b[0];', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
        it('concatPrimitive_Access1', function (done) {
            test('var a = ["foo"]; b = a.concat(34); RESULT = b[1];', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
        it('concatArray_Access0', function (done) {
            test('var a = ["foo"]; b = a.concat([34]); RESULT = b[0];', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
        it('concatArray_Access1', function (done) {
            test('var a = ["foo"]; b = a.concat([34]); RESULT = b[1];', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
        it('pushSingle_Access0', function (done) {
            test('var a = ["foo"]; a.push(34); RESULT = a[0];', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
        it('pushSingle_Access1', function (done) {
            test('var a = ["foo"]; a.push(34); RESULT = a[1];', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
        it('pushMulti_Access0', function (done) {
            test('var a = []; b = a.push("foo", 34); RESULT = a[0];', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
        it('pushMulti_Access1', function (done) {
            test('var a = []; b = a.push("foo", 34); RESULT = a[1];', function (type:TupleType) {
                assert.deepEqual(type, ONumberString);
            }, config, precisionConfig, done);
        });
    });

    describe("Context insensitivity", function () {
        var config = inferenceConfigs.fullIntersection;
        var precisionConfig = precisionConfigs.contextInsensitive;

        it('id function should merge', function (done) {
            test('function f(x){return x;} f("foo"); RESULT = f(42);', function (type:TupleType) {
                assert.deepEqual(type, top);
            }, config, precisionConfig, done);
        });
        it('Should merge through variables', function (done) {
            test('function f(x){var v = x; return v;} f("foo"); RESULT = f(42);', function (type:TupleType) {
                assert.deepEqual(type, top);
            }, config, precisionConfig, done);
        });
        it('Should merge parameters', function (done) {
            test('function f(x){if(x === "foo"){ return x; } else { return x; };} f("foo"); RESULT = f(42);', function (type:TupleType) {
                assert.deepEqual(type, top);
            }, config, precisionConfig, done);
        });
        it('Should merge returns', function (done) {
            test('function f(x, y){if(x === "foo"){ return x; } else { return y; };} f("foo", 42); RESULT = f("bar", 42);', function (type:TupleType) {
                assert.deepEqual(type, top);
            }, config, precisionConfig, done);
        });
        it('Should have call-local variables', function (done) {
            // will fail if the variable 'x' is treated context insensitively
            test('var first = true; function f(){ var x = "BAD"; if(first){x = 42; first = false; f(); return x;} return 42;} RESULT = f();', function (type:TupleType) {
                assert.deepEqual(type, Number);
            }, config, precisionConfig, done);
        });
        it('Should have flow sensitive variables', function (done) {
            test('var x = "foo"; x = 42; RESULT =  x;', function (type:TupleType) {
                assert.deepEqual(type, Number);
            }, config, precisionConfig, done);
        });
    });
    describe("Flow insensitivity", function () {
        var config = inferenceConfigs.fullIntersection;
        var precisionConfig = precisionConfigs.flowInsensitive;

        it('Should merge default initialization', function (done) {
            test('var x; x = 42; RESULT =  x;', function (type:TupleType) {
                assert.deepEqual(type, ONumber);
            }, config, precisionConfig, done);
        });
        it('Should merge multiple assignments', function (done) {
            test('var x = "foo"; x = 42; RESULT =  x;', function (type:TupleType) {
                assert.deepEqual(type, top);
            }, config, precisionConfig, done);
        });
        it('Should support precise single calls', function (done) {
            test('function id(x){return x;} RESULT = id("foo");', function (type:TupleType) {
                assert.deepEqual(type, OString /* 'O' due to test framework */);
            }, config, precisionConfig, done);
        });
        it('Should be context sensitive', function (done) {
            test('function id(x){return x;} id(42); RESULT = id("foo");', function (type:TupleType) {
                assert.deepEqual(type, OString /* 'O' due to test framework */);
            }, config, precisionConfig, done);
        });
    });
});