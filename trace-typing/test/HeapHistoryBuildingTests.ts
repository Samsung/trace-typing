///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../src/types.d.ts"/>

import assert = require("./assert-async-mocha");
import path = require("path");
import TraceImporter = require("../src/TraceImporter");
var replayTrace = require("../src/trace-replaying/TraceReplayer").replayTrace;
import AST = require("../src/TraceLanguageAST");
import HeapHistoryVizualizer = require("../src/trace-replaying/HeapHistoryVisualizer");

import maker = require("../src/TraceMaker");

describe("HeapHistoryBuilding", function () {
    describe("Should not crash on any traces", function () {
        this.timeout(60 * 1000);
        var traceImporter:TraceImporter.TraceImporter = new TraceImporter.TraceImporter();
        traceImporter.getAllTraceFiles().forEach(function (file) {
            if (file.indexOf("JSON_nan_bug") !== -1) {
                return; // ignore
            }
            it("... in particular: " + path.basename(file), function (done) {
                traceImporter.import(file, function (err:any, imported:TraceImport) {
                    if (err) {
                        done(err);
                    }
                    replayTrace(imported.trace);
                    done();
                });
            });
        });
    });
    describe("Should not crash on custom traces", function () {
        function test(source:string, done:Function) {
            maker.getTraceFromSource(source, function (err:any, trace:Trace) {
                if (err) {
                    done(err);
                    return;
                }
                trace.statements.forEach(function (e) {
                    //console.log(e.toString());
                });
                try {
                    replayTrace(trace);
                } catch (e) {
                    done(e);
                    throw e;
                }
                done();
            });
        }

        it("Should handle calls", function (done) {
            test("function f(){} f();", done);
        });
        it("Should handle calls with implicit this", function (done) {
            test("function f(){return this;} f();", done);
        });
        it("Should handle calls with implicit this usage", function (done) {
            test("function f(){return this.p;} f();", done);
        });
        it("Should handle calls with explicit this", function (done) {
            test("function f(){return this;} var o = {f: f}; o.f();", done);
        });
        it("Should handle calls with explicit this usage", function (done) {
            test("function f(){return this.p;} var o = {f: f}; o.f();", done);
        });
        it("Should handle calls with explicit class-instance this", function (done) {
            test("function f(){return this;} function K(){this.f = f}; var o = new K(); o.f();", done);
        });
        it("Should handle calls with explicit class-instance this usage", function (done) {
            test("function f(){return this.p;} function K(){this.f = f}; var o = new K(); o.f();", done);
        });
        it("Should handle prototype-function1-calls with explicit class-instance this", function (done) {
            test("function f(){return this;} function K(){}; K.prototype = {f: f}; var o = new K(); o.f();", done);
        });
        it("Should handle prototype-function1-calls with explicit class-instance this usage", function (done) {
            test("function f(){return this.p;} function K(){}; K.prototype = {f: f}; var o = new K(); o.f();", done);
        });
        it("Should handle prototype-function2-calls with explicit class-instance this", function (done) {
            test("function f(){return this;} function K(){}; K.prototype = {}; K.prototype.f = f; var o = new K(); o.f();", done);
        });
        it("Should handle prototype-function2-calls with explicit class-instance this usage", function (done) {
            test("function f(){return this.p;} function K(){}; K.prototype = {}; K.prototype.f = f; var o = new K(); o.f();", done);
        });
        it("Should handle delete of function calls", function (done) {
            test('var x = {a: 1, b:2};\n' +
            'function foo() {\n' +
            '    return {y:x};\n' +
            '}\n' +
            'delete foo().y.a;\n' +
            'delete foo().y;\n' +
            'delete x.b;\n' +
            'x.a;', done);
        });
        it("Should handle delete of function calls, simple", function (done) {
            test('var x = {a: 1, b:2};\n' +
                'function foo() {\n' +
                '    return {y:x};\n' +
                '}\n' +
                'delete foo().y.a;\n'
                , done);
        });
        it("Should handle access to function call properties", function (done) {
            test('var x = {a: 1, b:2};\n' +
                'function foo() {\n' +
                '    return {y:x};\n' +
                '}\n' +
                'foo().y.a;\n'
                , done);
        });
        it("Should handle access to function call properties, simple", function (done) {
            test('function foo() {\n' +
                '    return {y:{}};\n' +
                '}\n' +
                'foo().y.a;\n'
                , done);
        });
        it("Should handle access to function call property", function (done) {
            test('function foo() {\n' +
                '    return {};\n' +
                '}\n' +
                'foo().y;\n'
                , done);
        });
        it("Should handle access to property", function (done) {
            test('({}.y);', done);
        });
        it("Should handle external calls", function (done) {
            test("toString();", done);
        });
        it("Should handle access to properties of function calls", function (done) {
            test("toString().x;", done);
        });
        it("Should handle update of properties of function calls", function (done) {
            test("toString().x++;", done);
        });
        it("Should handle access to properties of method calls", function (done) {
            test("this.toString().x;", done);
        });
        it("Should handle update of properties of method calls", function (done) {
            test("this.toString().x++;", done);
        });
        it("Should handle String(..)", function (done) {
            test("var x = String(42); x.length;", done);
        });
        it("Should handle new String(..)", function (done) {
            test("var x = new String(42); x.length;", done);
        });
        it("Should handle access to <object>.prototype", function (done) {
            test("({}).prototype;", done);
        });
        it("Should handle access to <function>.prototype", function (done) {
            test("function K(){} K.prototype;", done);
        });
        it("Should handle custom constructor call", function (done) {
            test("function K(){} new K();", done);
        });
        it("Should handle property access at global scope", function (done) {
            test("Date.prototype;", done);
        });
        it("Should handle prototype property access with prior .prototype access", function (done) {
            test("Date.prototype; new Date().getDay", done);
        });
        it("Should handle prototype property access without prior .prototype access", function (done) {
            test("new Date().getDay", done);
        });
        it("Should handle references to node-module-local variables", function (done) {
            test("module; require; exports", done);
        });
        it("Should handle require(...)", function (done) {
            test("require('events');", done);
        });
        it("Should handle require(...).something", function (done) {
            test("require('events').EventEmitter;", done);
        });
        it("Should handle arguments indexing", function (done) {
            test("(function () {arguments[0];})({});", done);
        });
        it("Should handle direct prototype call", function (done) {
            test("toString();", done);
        });
        it("Should handle call with Function.prototype.call", function (done) {
            test("Object.prototype.toString.call('x');", done);
        });
        it("Should handle call with Function.prototype.call, with default base", function (done) {
            test("Object.prototype.toString.call();", done);
        });
        it("Should handle call with Function.prototype.apply", function (done) {
            test("Object.prototype.toString.apply('x', []);", done);
        });
        it("Should handle prototype call with Function.prototype.call", function (done) {
            test("toString.call();", done);
        });
        it("Should handle array accesses correctly", function (done) {
            test("function f() {var results = [];results[0] = [];return results;};var a = f();a[0];", done);
        });
        it("Should handle access to properties of constructor call results", function (done) {
            test("function A() {this.p = undefined;}({q: new A()}.q)", done);
        });
        it("Should handle primitive property accesess", function (done) {
            test("'foo'.length", done);
        });
        it("Should handle primitive property array-like accesess", function (done) {
            test("'foo'[42]", done);
        });
        it("Should handle parameters to DPA method", function (done) {
            test("var o = {m: function(a){a[0];}}; o['m']([])", done);
        });
        it("Should handle parameters Array-concat with apply and multiple arguments", function (done) {
            test("Array.prototype.concat.apply([], [[], [], []])", done);
        });
        it("Should handle Object.defineProperty", function (done) {
            test("Object.defineProperty(String.prototype, 'foo', {'value': {}});''.foo", done);
        });
        it("Should handle slice on strings, complex", function (done) {
            test("var arrayRef = []; slice = arrayRef.slice; slice.call('x')[0] != 'x'", done);
        });
        it("Should handle slice on strings, simple", function (done) {
            test("Array.prototype.slice.call('x')", done);
        });
        it.skip("Should handle defined setters", function (done) {
            test("var o = {}; Object.defineProperty(o, 'p', {set: function(v){this._p  = v;}}); o.p = {}; o._p;", done);
        });
        it.skip("Should handle defined getters", function (done) {
            test("var o = {_p: {}}; Object.defineProperty(o, 'p', {get: function(v){return this._p;}}); o.p;", done);
        });
        it("Should handle Object referencing", function (done) {
            test("var Object = global.Object;", done);
        });
        it("Should handle Array splice #1, primitives", function (done) {
            test("var a = [1, 2, 3]; a.splice(0, 0, 4, 5); a[0]; a[4];", done);
        });
        it("Should handle Array splice #2, primitives", function (done) {
            test("var a = [1, 2, 3]; a.splice(3, 0, 4, 5); a[0]; a[4];", done);
        });
        it("Should handle Array splice #3, arrays", function (done) {
            test("var a = [[1], [2], [3]]; a.splice(0, 0, [4], [5]); a[0][0]; a[4][0];", done);
        });
        it("Should handle Array splice #4, arrays", function (done) {
            test("var a = [[1], [2], [3]]; a.splice(3, 0, [4], [5]); a[0][0]; a[4][0];", done);
        });

        describe("Regression files", function () {
            function testDir(dir:string, main:string, done:Function) {
                maker.getTraceFromDir({dir: dir, main: dir + "/" + main}, function (err:any, trace:Trace) {
                    if (err) {
                        done(err);
                        return;
                    }
                    trace.statements.forEach(function (e) {
                        //console.log(e.toString());
                    });
                    try {
                        replayTrace(trace);
                    } catch (e) {
                        done(e);
                        throw e;
                    }
                    done();
                });
            }

            function testFile(file:string, done:Function) {
                maker.getTraceFromSourceFile(file, function (err:any, trace:Trace) {
                    if (err) {
                        done(err);
                        return;
                    }
                    trace.statements.forEach(function (e) {
                        //console.log(e.toString());
                    });
                    try {
                        replayTrace(trace);
                    } catch (e) {
                        done(e);
                        throw e;
                    }
                    done();
                });
            }

            it.skip("DEBUG SOURCE", function (done) {
                this.timeout(5 * 60 * 1000);
                testFile("test/fixtures/debug_source.js", done);
            });
            it("names of functions", function (done) {
                testFile("test/fixtures/functionNamingScopes.js", done);
            });
            it("Misc. export/require usages", function (done) {
                testDir("test/fixtures/multiple-files-2", "requireSomething.js", done);
            });
            it("coffeescript requires", function (done) {
                this.timeout(60 * 1000);
                testDir("test/fixtures/multiple-files-3", "require_lexer.js", done);
            });
            it("require with nested require", function (done) {
                this.timeout(60 * 1000);
                testDir("test/fixtures/multiple-files-4", "require_with_nested_require.js", done);
            });
        });
    });
    describe("Should make correct histories", function () {
        var propertyChange = "(function(){var o = {a: 'foo'}; o.a = 76;})();";
        var propertyChanges = "(function(){var o = {a: 'foo'}; o.a = 76; o.a = 'foo';})();";
        var newProperty = "(function(){var o = {a: 'foo'}; o.b = 78;})();";
        var newPropertyThatChangesValue = "(function(){var o = {a: 'foo'}; o.b = 78; o.b = 'foo';})();";
        var newProperties = "(function(){var o = {a: 'foo'}; o.b = 42; o.c = 42;})();";

        function test(source:string, body:Function, done:Function) {
            maker.getTraceFromSource(source, function (err:any, trace:Trace) {
                if (err) {
                    done(err);
                    return;
                }
                try {
                    var instances:Instance[] = replayTrace(trace).instances;
                    var objectHistories = instances.filter(instance => instance.shapes.length > 1);// a non-trivial history
                    assert.equal(objectHistories.length, 1, done, "Not a unqiue object history!", true);
                    body(objectHistories[0]);
                } catch (e) {
                    done(e);
                }
            });
        }

        var stringKind = AST.PrimitiveKind.String;
        var numberKind = AST.PrimitiveKind.Number;

        var propPrimKind = function (instance:Instance, historyIndex:number, propertyName:string) {
            return (<Primitive>instance.shapes[historyIndex].getPropertyValue(propertyName)).primitiveKind;
        };
        var propLength = function (instance:Instance, historyIndex:number) {
            return instance.shapes[historyIndex].getPropertyNames().length;
        };
        var length = function (instance:Instance) {
            return instance.shapes.length;
        };
        it("Should handle property change", function (done) {
            test(propertyChange, function (instance:Instance) {
                assert.equal(length(instance), 2, done, undefined, true);
                assert.equal(propLength(instance, 0), 1, done, undefined, true);
                assert.equal(propLength(instance, 1), 1, done, undefined, true);
                assert.equal(propPrimKind(instance, 0, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 1, 'a'), numberKind, done, undefined, false);
            }, done);
        });
        it("Should handle property changes", function (done) {
            test(propertyChanges, function (instance:Instance) {
                assert.equal(length(instance), 3, done, undefined, true);
                assert.equal(propLength(instance, 0), 1, done, undefined, true);
                assert.equal(propLength(instance, 1), 1, done, undefined, true);
                assert.equal(propLength(instance, 2), 1, done, undefined, true);
                assert.equal(propPrimKind(instance, 0, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 1, 'a'), numberKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 2, 'a'), stringKind, done, undefined, false);
            }, done);
        });
        it("Should handle new property", function (done) {
            test(newProperty, function (instance:Instance) {
                assert.equal(length(instance), 2, done, undefined, true);
                assert.equal(propLength(instance, 0), 1, done, undefined, true);
                assert.equal(propLength(instance, 1), 2, done, undefined, true);
                assert.equal(propPrimKind(instance, 0, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 1, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 1, 'b'), numberKind, done, undefined, false);
            }, done);
        });
        it("Should handle new properties", function (done) {
            test(newProperties, function (instance:Instance) {
                assert.equal(length(instance), 3, done, undefined, true);
                assert.equal(propLength(instance, 0), 1, done, undefined, true);
                assert.equal(propLength(instance, 1), 2, done, undefined, true);
                assert.equal(propLength(instance, 2), 3, done, undefined, true);
                assert.equal(propPrimKind(instance, 0, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 1, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 2, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 1, 'b'), numberKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 2, 'b'), numberKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 2, 'c'), numberKind, done, undefined, false);
            }, done);
        });
        it("Should handle new property that changes", function (done) {
            test(newPropertyThatChangesValue, function (instance:Instance) {
                assert.equal(length(instance), 3, done, undefined, true);
                assert.equal(propLength(instance, 0), 1, done, undefined, true);
                assert.equal(propLength(instance, 1), 2, done, undefined, true);
                assert.equal(propLength(instance, 2), 2, done, undefined, true);
                assert.equal(propPrimKind(instance, 0, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 1, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 2, 'a'), stringKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 1, 'b'), numberKind, done, undefined, true);
                assert.equal(propPrimKind(instance, 2, 'b'), stringKind, done, undefined, false);
            }, done);
        });
    });
});
