///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../src/types.d.ts"/>
import TraceImporter = require("../src/TraceImporter")
import assert = require("./assert-async-mocha");
import TypeInferencer = require("../src/typing/TypeInferencer");
import TypeLattices = require("../src/typing/TypeLattices");
import TypeImpls = require("../src/typing/TypeImpls");
import AST = require("../src/TraceLanguageAST");
import TraceMaker = require("../src/TraceMaker");
import Misc = require('../src/Misc');
import path = require('path');

var replayTrace = require("../src/trace-replaying/TraceReplayer").replayTrace;
var None = Misc.None;
var Some = Misc.Some;

function mkInferencer() {
    var fullIntersectionLattices = TypeLattices.makeFullIntersection();
    var intersectionWFieldLubSubtypingLattices = TypeLattices.makeLatticeFromEnums(TypeLattices.ObjectTypeLatticeKinds.ObjectFieldLubUnderSubtyping, TypeLattices.FunctionTypeLatticeKinds.FunctionIntersection, []);
    var activeLattices = intersectionWFieldLubSubtypingLattices;
    var inferencer = new TypeInferencer.TypeInferencerImpl(activeLattices.types, activeLattices.initialFunctionTypeMaker);
    return (instance:Instance) => inferencer.inferObjectType([instance], [])
}


function test(source:string, actualTest:(err:any, instances:Instance[])=>void) {
    TraceMaker.getTraceFromSource(source, function (err:any, trace:Trace) {
        if (err) {
            actualTest(err, undefined);
            return;
        }
        try {
            var results:TraceReplayResults = replayTrace(trace);
            actualTest(undefined, results.instances);
        } catch (e) {
            actualTest(e, undefined);
        }
    });
}
function testFile(sourceFile:string, actualTest:(err:any, instances:Instance[])=>void) {
    TraceMaker.getTraceFromSourceFile(sourceFile, function (err:any, trace:Trace) {
        if (err) {
            actualTest(err, undefined);
            throw err;
        }
        var results:TraceReplayResults = replayTrace(trace);
        actualTest(undefined, results.instances);
    });
}

function makeInferenceFunction(done:Function) {
    return function (err:any, instances:Instance[]) {
        if (err) {
            done(err);
            return;
        }
        var i = 0;
        var stackOverflowErrors = 0;
        var inferencer = mkInferencer();
        instances.forEach(instance => {
            i++;
            try {
                var objectType = inferencer(instance);
            } catch (e) {
                if (e.message.indexOf("stack") !== -1) {
                    stackOverflowErrors++;
                    console.warn("%s x %d", e, stackOverflowErrors);
                } else {
                    throw e;
                }
            }
            //if (objectType.properties.p !== undefined)
            //    console.log(TypeImpls.toPrettyString(objectType.properties.p));
        });
        done();
    }
}
// NB: thorough case-by-case tests should be done in TypeInferencerUnitTests
describe("TypeInferencer on traces", function () {
    describe("on handwritten applications", function () {
        it("Should not crash on the initial state", function (done) {
            this.timeout(60 * 1000);
            test("", (err:any, instances:Instance[]) => {
                if (err) {
                    done(err);
                    return;
                }
                var inferencer = mkInferencer();
                instances.forEach(instance => {
                    inferencer(instance);
                });
                done();
            });
        });

        describe("misc", function () {
            this.timeout(60 * 1000);
            function myTest(src:string, done:(err?:any)=>void) {
                test(src, makeInferenceFunction(done));
            };
            it("Should handle initial environment", function (done) {
                myTest("", done);
            });
            it("Should handle a call", function (done) {
                myTest("(function(){})()", done);
            })
            it("Should handle a native call", function (done) {
                myTest("toString()", done);
            });
        });
        describe("on recursive structures", function () {
            this.timeout(20 * 1000);
            function myTest(src:string, done:(err?:any)=>void) {
                test(src, makeInferenceFunction(done));
            };

            it("Should handle self recursion", function (done) {
                myTest("var o = {p: undefined}; o.p = o;", done);
            });
            it("Should handle bi-mutual recursion for identical shapes", function (done) {
                myTest("var o1 = {p: undefined}; var o2 = {p: undefined}; o1.p = o2; o2.p = o1;", done);
            });
            it("Should handle bi-mutual recursion for different shapes", function (done) {
                myTest("var o1 = {p1: undefined}; var o2 = {p2: undefined}; o1.p1 = o2; o2.p2 = o1;", done);
            });
            it("Should handle bi-mutual recursion for different shapes with different types on edges", function (done) {
                myTest("var o1 = {p1: undefined, p2: 'foo'}; var o2 = {p2: undefined}; o1.p1 = o2; o2.p2 = o1;", done);
            });
            it("Should handle long cycles", function (done) {
                myTest("var o1 = {p: undefined}; var o2 = {p: undefined}; var o3 = {p: undefined}; o1.p = o2; o2.p = o3; o3.p = o1;", done);
            });
            it("Should handle cyclic graphs", function (done) {
                myTest("var o1 = {p1: undefined}; var o2 = {p2: undefined}; var o3 = {p3: undefined}; o1.p1 = o2; o2.p2 = o1; o3.p3 = o1; o3.p3 = o2;", done);
            });

            it("Heterogeneous linked, cyclic list", function (done) {
                myTest("var o1 = {p1: undefined}; var o2 = {p2: o1}; var o3 = {p3: o2}; var o4 = {p4: o3}; o1.p1 = o4;", done);
            });
            it("Homogeneous linked, cyclic list", function (done) {
                myTest("var o1 = {p: undefined}; var o2 = {p: o1}; var o3 = {p: o2}; var o4 = {p: o3}; o1.p = o4;", done);
            });
            it("Heterogeneous doubly linked, cyclic list", function (done) {
                myTest("var o1 = {p1: undefined, f1: undefined}; var o2 = {p2: o1, f2: undefined}; var o3 = {p3: o2, f3: undefined}; var o4 = {p4: o3, f4: undefined}; o1.p1 = o4; o1.f1 = o2; o2.f2 = o3; o3.f3 = o4; o4.f4 = o1;", done);
            });
            it("Homogeneous doubly linked, cyclic list", function (done) {
                myTest("var o1 = {p: undefined, f: undefined}; var o2 = {p: o1, f: undefined}; var o3 = {p: o2, f: undefined}; var o4 = {p: o3, f: undefined}; o1.p = o4; o1.f = o2; o2.f = o3; o3.f = o4; o4.f = o1;", done);
            });
            it("Should handle ambiguous self recursion", function (done) { // NB: depends on merge of resolved recursive type and the type it is ambiguous with
                myTest("var o1 = {x: 'foo'}; var o2 = {p: o1}; o2.p = o2;", done);
            });
            it("Should handle ambiguous recursion", function (done) { // NB: depends on merge of resolved recursive type and the type it is ambiguous with
                myTest("var o1 = {}; var o2 = {p: o1}; var o3 = {}; o2.p = o3; o1.p = o2;", done);
            });
            it("Should handle merge of multiple recursives #1", function (done) {
                myTest("var o1 = {}; var o2 = {}; var o3 = {}; o1.p1 = o2; o1.p1 = o3; o2.p2 = o1; o3.p3 = o1;", done);
            });
            it("Should handle merge of multiple similar recursives #1", function (done) {
                myTest("var o1 = {}; var o2 = {}; var o3 = {}; o1.p = o2; o1.p = o3; o2.p = o1; o3.p = o1;", done);
            });
            it("Should handle merge of multiple recursives #2", function (done) {
                myTest("var o1 = {p1: undefined}; var o2 = {p2: undefined}; var o3 = {p3: undefined}; o1.p1 = o2; o1.p1 = o3; o2.p2 = o1; o3.p3 = o1;", done);
            });
            it("Should handle merge of multiple similar recursives #2", function (done) {
                myTest("var o1 = {p: undefined}; var o2 = {p: undefined}; var o3 = {p: undefined}; o1.p = o2; o1.p = o3; o2.p = o1; o3.p = o1;", done);
            });
        });
    });
    describe("Simplified applications", function () {
        this.timeout(10 * 60 * 1000);
        function myTest(file:string, done:(err?:any)=>void) {
            testFile(file, makeInferenceFunction(done));
        };
        it("underscore-singlefile", function (done) {
            myTest("test/fixtures/underscore-singlefile.js", done)
        });

        it("underscore_ambiguous-recusive-type", function (done) {
            myTest("test/fixtures/underscore_ambiguous-recusive-type.js", done)
        });
        it.skip("debug_source", function (done) {
            myTest("test/fixtures/debug_source.js", done)
        });
    });
    describe("On real traces", function () {
        describe("Should not crash", function () {
            this.timeout(1 * 30 * 1000);
            var traceImporter:TraceImporter.TraceImporter = new TraceImporter.TraceImporter();
            traceImporter.getAllTraceFiles().forEach(function (file) {
                if (file.indexOf("JSON_nan_bug") !== -1 || file.indexOf(".load") !== -1 || file.indexOf(".use") !== -1 || file.indexOf("/underscore") !== -1) {
                    return; // ignore
                }
                it("... for " + path.basename(file) + " ...", function (done) {
                    traceImporter.import(file, function (err:any, imported:TraceImport) {
                        if (err) {
                            done(err);
                        }
                        var trace:Trace = imported.trace;
                        var results:TraceReplayResults = replayTrace(trace);
                        var inferencer = mkInferencer();
                        results.instances.forEach(instance => {
                            inferencer(instance);
                        });
                        done();
                    });
                });
            });
        });
    });
})
;