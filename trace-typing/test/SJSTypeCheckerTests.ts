///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../src/types.d.ts"/>

import assert = require("assert");
import path = require("path");
import fs = require("fs");

import PersistentResults = require("../src/PersistentResults")
import Misc = require("../src/Misc")
import TraceImporter = require("../src/TraceImporter")
import TraceMaker = require("../src/TraceMaker");
import TypeInferencer = require("../src/typing/TypeInferencer");
import TypeLattices = require("../src/typing/TypeLattices");
import TypeChecker = require("../src/typing/TypeChecker");
import TypeImpls = require("../src/typing/TypeImpls");
import MetaInformationExplainerImpl = require("../src/MetaInformationExplainer");
import VariableManager = require("../src/VariableManager");
import TraceReplayer = require("../src/trace-replaying/TraceReplayer");
import TypedTraceReplayer = require("../src/trace-replaying/TypedTraceReplayer");
import maker = require("../src/TraceMaker");
import TypeCheckerTester = require('./TypeCheckerTester');

function testFile(source:string, expectedErrorCount:number, done:Function, flowConfig:PrecisionConfig) {
    TraceMaker.getTraceFromSourceFile(source, function (err:any, trace:Trace) {
        TypeCheckerTester.testTrace(err, trace, expectedErrorCount, TypeLattices.makeSJS, done, flowConfig, 'SJS', true);
    });
}
function testSource(source:string, expectedErrorCount:number, done:Function, flowConfig:PrecisionConfig) {
    TraceMaker.getTraceFromSource(source, function (err:any, trace:Trace) {
        TypeCheckerTester.testTrace(err, trace, expectedErrorCount, TypeLattices.makeSJS, done, flowConfig, 'SJS', true);
    });
}
describe("SJSTypeChecker unit tests", function () {
    this.timeout(5 * 1000);
    describe("sanityChecks", function () {
        it('Should not find errors for empty program', function (done) {
            testSource("", 0, done, {});
        });
        it('Should not find errors for primitive program', function (done) {
            testSource("2 + 2;", 0, done, {});
        });
        it('Should allow valid property access', function (done) {
            testSource("({p: 42}).p", 0, done, {});
        });
        it('Should disallow invalid property access', function (done) {
            testSource("({}).p", 1, done, {});
        });
        it('Should allow allocations', function (done) {
            testSource("({})", 0, done, {});
        });
        it('Should allow function allocations', function (done) {
            testSource("(function(){})", 0, done, {});
        });
        it('Should allow function invocations', function (done) {
            testSource("(function(){})()", 0, done, {});
        });
        it('Should allow function invocations with arguments', function (done) {
            testSource("(function(x){})(42)", 0, done, {});
        });
        it('Should allow function invocations with multiple arguments', function (done) {
            testSource("(function(x, y){})(42, 0)", 0, done, {});
        });
        it('Should allow function invocations with multiple type arguments', function (done) {
            testSource("(function(x, y){})(42, 'foo')", 0, done, {});
        });
        it('Should allow variable assignments', function (done) {
            testSource("(function(){ var a = 42; })()", 0, done, {});
        });
        it('Should allow variable redefinitions', function (done) {
            testSource("(function(){ var a = 42; a = 'foo';})()", 0, done, {});
        });
        it('Should allow valid property access through variable', function (done) {
            testSource("(function(){var o = {p: 42}; o.p})()", 0, done, {});
        });
        it('Should find true error', function (done) {
            testSource("({}).p", 1, done, {});
        });
        it('Should allow access to prototype proterties', function (done) {
            testSource("var o = {}; o.toString", 0, done, {});
        });
    });
    describe("Misc. property accesses", function () {
        it('Should not allow late addition of property', function (done) {
            testSource("var o = {}; o.p = 42;", 1, done, {});
        });
        it('Should allow late setting of property type', function (done) {
            testSource("var o = {p: undefined}; o.p = 42;", 0, done, {});
        });
        it('Should not allow conflicting setting of property type', function (done) {
            testSource("var o = {p: 'foo'}; o.p = 42;", 1, done, {});
        });
        it('Should allow conflicting setting of method (method def is merged)', function (done) {
            testSource("var o = {f: function(){ return 'foo'; }}; o.f(); o.f = function(){ return 42;}; o.f();", 0, done, {});
        });
        it('Should not allow conflicting late setting of method (method def is merged)', function (done) {
            testSource("var o = {f: undefined}; o.f = function(){ return 'foo'; }; o.f(); o.f = function(){ return 42;}; o.f();", 0, done, {});
        });
        it('Should allow prototype property lookup', function (done) {
            testSource("var o = {}; o.toString;", 0, done, {});
        });
        it('Should not allow writes to read-only properties', function (done) {
            testSource("var o = {}; o.toString = function(){};", 1, done, {});
        });
        it('Should not allow writes to read-only properties, esp. not with the wrong type', function (done) {
            testSource("var o = {}; o.toString = 42;", 2, done, {});
        });
        it('Should not allow writes to read-only properties of arrays', function (done) {
            testSource("var o = []; o.toString = function(){};", 1, done, {});
        });
        it('Should allow reads of prototype properties of arrays', function (done) {
            testSource("var o = []; o.toString", 0, done, {});
        });
        it('Should allow writes to non-read-only properties', function (done) {
            testSource("var o = {toString: undefined}; o.toString = function(){};", 0, done, {});
        });
        it('Should not allow prototype property overriding with incompatible type #1', function (done) {
            testSource("var o = {toString: 42};", 1, done, {});
        });
        it('Should not allow prototype property overriding with incompatible type #2', function (done) {
            testSource("var o = {toString: undefined}; o.toString = 42;", 1, done, {});
        });
        it('Should not allow prototype method overriding with incompatible type', function (done) {
            testSource("var o = {toString: function(){return 42;}}; Object.prototype.toString.call(o); o.toString();", 1, done, {});
        });
        it('Should allow prototype property overriding with compatible type', function (done) {
            testSource("var o = {toString: function(){}};", 0, done, {});
        });

        it('Should not allow arguments write', function (done) {
            testSource("function f(){ arguments.x = 42; } f()", 2, done, {});
        });
        it('Should not allow arguments read', function (done) {
            testSource("function f(){ arguments.x; } f()", 2, done, {});
        });
        it('Should not allow arguments integral-write', function (done) {
            testSource("function f(x){ arguments[0] = 42; } f(42)", 1, done, {});
        });
        it('Should not allow arguments integral-read', function (done) {
            testSource("function f(x){ arguments[0]; } f(42)", 1, done, {});
        });
    });
    describe("Maps, Objects, Arrays", function () {
        it('Should allow static reads of object properties', function (done) {
            testSource("var o = {p: 42}; o.p;", 0, done, {});
        });
        it('Should not allow dynamic reads of object properties', function (done) {
            testSource("var o = {p: 42}; o['p'];", 1, done, {});
        });

        it('Should not allow static reads of map properties', function (done) {
            testSource("var m = {}; m['p'] = 42; m.p;", 1, done, {});
        });
        it('Should allow dynamic reads of map properties', function (done) {
            testSource("var m = {}; m['p'] = 42; m['p'];", 0, done, {});
        });

        it('Should allow static reads of array non-numeric properties', function (done) {
            testSource("var a = []; a.toString;", 0, done, {});
        });
        it('Should not allow dynamic reads of array non-integral properties #1', function (done) {
            testSource("var a = []; a['toString'];", 1, done, {});
        });
        it('Should not allow dynamic reads of array non-integral properties #2', function (done) {
            testSource("var a = []; a['-1.5'];", 2, done, {});
        });

        it('Should not allow dynamic writes to array non-integral properties', function (done) {
            testSource("var a = []; a['toString'] = function(){};", 2, done, {});
        });
        it('Should not allow static writes to array properties', function (done) {
            testSource("var a = []; a.toString = function(){};", 1, done, {});
        });

        it('Should allow dynamic reads of array integral properties #1', function (done) {
            testSource("var a = [42]; a[0];", 0, done, {});
        });
        it('Should allow dynamic reads of array integral properties #2', function (done) {
            testSource("var a = [42]; a[-1];", 0, done, {});
        });
        it('Should allow dynamic reads of array integral properties #3', function (done) {
            testSource("var a = [42]; a['1'];", 0, done, {});
        });
        it('Should allow dynamic writes of existing array integral properties', function (done) {
            testSource("var a = [42]; a[0] = 42;", 0, done, {});
        });
        it('Should allow dynamic writes of non-existing array integral properties', function (done) {
            testSource("var a = [42]; a[1] = 42;", 0, done, {});
        });

        it('Should allow dynamic reads of (empty-)array numeric properties', function (done) {
            testSource("var a = []; a[0];", 0, done, {});
        });

        it('Should not allow dynamic reads of the empty object', function (done) {
            testSource("var o = {}; o['x'];", 2, done, {});
        });

        describe("Homegenous arrays & maps", function () {
            it('Should not allow conflicting writes to array properties #1', function (done) {
                testSource("var a = [42]; a[0] = 'foo'", 1, done, {});
            });
            it('Should not allow conflicting writes to array properties #2', function (done) {
                testSource("var a = [42]; a[1] = 'foo'", 1, done, {});
            });
            it('Should not allow conflicting writes to array properties #3', function (done) {
                testSource("var a = []; a[0] = 42; a[0] = 'foo'", 1, done, {});
            });
            it('Should not allow conflicting writes to map properties #1', function (done) {
                testSource("var m = {}; m['x'] = 42; m['x'] = 'foo'", 1, done, {});
            });
            it('Should not allow conflicting writes to map properties #2', function (done) {
                testSource("var m = {}; m['x'] = 42; m['y'] = 'foo'", 1, done, {});
            });
        });

        describe("for-in", function () {
            it('Should not allow iteration over object properties', function (done) {
                testSource("for(var p in {}){}", 1, done, {});
            });
            it('Should allow iteration over map properties', function (done) {
                testSource("var m = {}; m['x'] = 42; for(var p in m){}", 0, done, {});
            });
            it('Should allow iteration over (empty-)array properties', function (done) {
                testSource("for(var p in []){}", 0, done, {});
            });
            it('Should allow iteration over array properties', function (done) {
                testSource("for(var p in [42]){}", 0, done, {});
            });
        });

        describe("deletions", function () {
            it('Should not allow delete on object #1', function (done) {
                testSource("var o = {}; delete o.p", 2, done, {});
            });
            it('Should not allow delete on object #2', function (done) {
                testSource("var o = {p: 42}; delete o.p", 1, done, {});
            });

            it('Should not allow delete on array prototype properties', function (done) {
                testSource("var a = []; delete a.toString", 1, done, {});
            });
            it('Should not allow delete on inexistent non-integral properties', function (done) {
                testSource("var a = []; delete a.p", 1, done, {});
            });
            it('Should allow delete on existing integral array properties', function (done) {
                testSource("var a = [42]; delete a[0]", 0, done, {});
            });
            it('Should allow delete on inexistent integral array properties', function (done) {
                testSource("var a = [42]; delete a[1]", 0, done, {});
            });
            it('Should allow delete on emtpy array', function (done) {
                testSource("var a = []; delete a[0]", 0, done, {});
            });

            it('Should allow delete on map', function (done) {
                testSource("var m = {}; m['p'] = 42; delete m.p", 0, done, {});
            });
            it('Should allow delete on inexistent property in map', function (done) {
                testSource("var m = {}; m['p'] = 42; delete m.q", 0, done, {});
            });
        });
    });

    describe("prototypes", function () {
        /**
         * makes a constructor call.
         * FIXME this is required to give the object a function type...
         */
        function cstr(name:string) {
            return "new " + name + "();";
        }

        var def_f_pRWInt = "function f(){} var _o = {p: 42, f: f}; f.call(_o);\n";
        var def_f_pROInt = "function f(){} function _K(){} _K.prototype = {p: 42, f: f}; var _o = new _K(); f.call(_o);\n";

        describe("prototype definition (hackery)", function () {
            /*
             * Multiple caveats:
             * - multiple redefinitions of .prototype allowed
             * - non-empty initial prototype can be replaced with a super type
             * - .prototype initializers are not type checked
             */

            it("Should allow adding properties to the initial prototype", function (done) {
                testSource("function K(){} K.prototype.p = 42;" + cstr("K"), 0, done, {})
            });
            it("Should allow redefining the empty prototype once", function (done) {
                testSource("function K(){} K.prototype = {};" + cstr("K"), 0, done, {})
            });
            it("Should allow redefining the empty prototype once, with non-empty object", function (done) {
                testSource("function K(){} K.prototype = {p: 42};" + cstr("K"), 0, done, {})
            });

            it("Should use redefined prototype", function (done) {
                testSource("function K(){} K.prototype = {p: 42}; K.prototype.p;" + cstr("K"), 0, done, {})
            });

            it("Should allow redefining the empty prototype twice with empty types", function (done) {
                testSource("function K(){} K.prototype = {}; K.prototype = {};" + cstr("K"), 0, done, {})
            });
            it("Should allow redefining the empty prototype twice with non-empty types", function (done) {
                testSource("function K(){} K.prototype = {p: 42}; K.prototype = {p: 42};" + cstr("K"), 0, done, {})
            });
            it("Should not allow redefining the empty prototype twice with subtype", function (done) {
                testSource("function K(){} K.prototype = {};" + cstr("K") /* call now to avoid extra type error */ + " K.prototype = {p: 42};", 1, done, {})
            });
            it("Should not allow redefining the empty prototype twice with supertype", function (done) {
                testSource("function K(){} K.prototype = {p: 42}; K.prototype = {};" + cstr("K"), 1, done, {})
            });
            it("Should not allow redefining the empty prototype twice with unrelated type", function (done) {
                testSource("function K(){}K.prototype = {p: 42}; " + cstr("K") /* call now to avoid extra type error */ + "K.prototype = {q: 'foo'};", 3 /* prototype is the Top object, both asignments fail */, done, {})
            })

            it("Should not allow redefining the non-empty prototype", function (done) {
                testSource("function K(){} K.prototype.p = 42; K.prototype = {};" + cstr("K"), 1, done, {})
            });
            it("Should not allow adding properties to the redefined prototype", function (done) {
                testSource("function K(){} K.prototype = {}; K.prototype.p = 42;" + cstr("K"), 1, done, {})
            });
        });

        describe("concrete objects", function () {
            it("Should allow method invocation on (empty) concrete objects", function (done) {
                testSource("({}).toString();", 0, done, {})
            });
            it("Should allow method invocation on (exact, MRO) concrete objects", function (done) {
                testSource(def_f_pROInt + "function K(){} K.prototype = {p: 42, f: f}; var o = new K(); o.toString();", 0, done, {})
            });
            it("Should allow method invocation on (exact, MRW) concrete objects", function (done) {
                testSource(def_f_pRWInt + "var o = {f: f, p: 42}; o.toString();", 0, done, {})
            });
            it("Should allow method invocation on (too large) concrete objects", function (done) {
                testSource(def_f_pRWInt + "var o = {f: f, p: 42, q: 'foo'}; o.toString();", 0, done, {})
            });
            it("Should allow method invocation on concrete prototype objects", function (done) {
                testSource(def_f_pROInt + "function K(){} K.prototype = {p: 42, f: f}; K.prototype.toString();" + cstr("K"), 0, done, {})
            });
        });

        describe("abstract objects", function () {
            // NB: this expects a significant departure from how SJS really identifies MRO/MRW!

            it("Should not allow method invocation on self-abstract (MRO) objects", function (done) {
                testSource(def_f_pROInt + "var o = {f: f}; o.toString();", 1, done, {})
            });
            it("Should not allow method invocation on self-abstract (MRW) objects", function (done) {
                testSource(def_f_pRWInt + "var o = {f: f}; o.toString();", 1, done, {})
            });
            it("Should not allow method invocation on prototype-abstract (MRW/RO conflict) objects", function (done) {
                testSource(def_f_pRWInt + "function K(){} K.prototype = {p: 42, f: f}; var o = new K(); o.toString();", 1, done, {})
            });
        });

        describe.skip("Method update", function () {
            // NB: this expects a significant departure from how SJS really identifies MRO/MRW!

            it("Should allow method update", function (done) {
                testSource("", -2, done, {})
            });
            it("Should allow method shadowing", function (done) {
                testSource("", -2, done, {})
            });
            it("Should allow method update on non-prototype, RIGHT???", function (done) {
                testSource("", -2, done, {})
            });

            it("Should not allow method update due to too small MRO", function (done) {
                testSource("", -2, done, {})
            });
            it("Should not allow method update due to too small MRW", function (done) {
                testSource("", -2, done, {})
            });

            it("Should not allow method shadowing due to too small MRO", function (done) {
                testSource("", -2, done, {})
            });
            it("Should not allow method shadowing due too small MRW", function (done) {
                testSource("", -2, done, {})
            });

            it("Should not allow method update due to wrong signature", function (done) {
                testSource("", -2, done, {})
            });
            it("Should not allow method shadowing due to wrong signature", function (done) {
                testSource("", -2, done, {})
            });
        });

        describe.skip("Constructors", function () {
            it("...", function (done) { // impl.: mark constructor this writes as initializations until constructor-end
                testSource("", -2, done, {})
            });
        });
    });
});


describe.skip("SJS smoke tests", function () {
    this.timeout(60 * 1000);
    it("Should handle optparse", function (done) {
        testFile("fixtures/optparse-singlefile.js", -2, done, {})
    });
});