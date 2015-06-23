//<reference path="../src/types.d.ts"/>
import Playground = require("../src/playground/Playground")

var Source = Playground.PlaySourceTarget;
var File = Playground.PlayFileTarget;
var Trace = Playground.PlayTraceTarget;
describe("Playground smoke tests", function () {
    this.timeout(60 * 1000);
    var playground = new Playground.Playground();
    var stdTarget = new Source("var o = {p1: 42, p2: 'foo'};\nfunction f(o, p){\n return o[p];\n}\nf(o,'p1');\nf(o, 'p2');");
    var stdExperimentName = "typeCheck::ObjectFieldLubUnderSubtyping:FunctionPointwiseLub::flowInsensitiveVariables:contextInsensitiveVariables";
    var dirTarget = new File("fixtures/multiple-files-1/main.js", "fixtures/multiple-files-1");
    var underscoreDir = "../trace-production/tests/exercisedApps/underscore";
    var underscoreTarget = new File(underscoreDir + "/main.js", underscoreDir);

    describe.skip("Loading all three target kinds: ", function () {
        playground.play({target: stdTarget, experimentName: stdExperimentName});
        //playground.play({target: new File("fixtures/non-empty.js"), experimentName: stdExperimentName});
        //playground.play({target: new Trace("fixtures/assign.trace"), experimentName: stdExperimentName});
    });

    describe.skip("Various outputs", function () {

        playground.play({
            target: stdTarget,
            experimentName: stdExperimentName,
            browser: true,
            stdout: true
        });
        playground.play({
            target: stdTarget,
            experimentName: stdExperimentName,
            browser: true,
            stdout: true,
            iidFilter: ["1/169"]
        });
    });
//    TODO: fix toString config type errors, update play API, fix "Top is not an object type error"

    describe.skip("Multiple files", function () {
        this.timeout(30 * 60 * 1000);
        //playground.play({
        //    target: dirTarget,
        //    experimentName: "inspectBase::fullIntersection:fullIntersection:none:iidContext",
        //    browser: true,
        //    stdout: true
        //});
        playground.play({
            target: underscoreTarget,
            experimentName: "typeCheck::ObjectFieldLubUnderSubtyping:FunctionIntersection:UndefinedAsOptionType::flowInsensitiveVariables:contextInsensitiveVariables",
            browser: false,
            stdout: false
        });
    });
    describe.skip("Misc. debugging", function () {
        playground.play({
            target: new File('../trace-production/tests/tracing/trace-example-1.js'),
            experimentName: stdExperimentName,
            browser: true
        });
    });

    describe.skip("Misc. experiments", function () {
        this.timeout(30 * 60 * 1000);
        playground.play({
            target: underscoreTarget,
            //target: new Source("var v = [[1, 2, 3]];"),
            //target: new Source([
            //    "var o1 = {p: 42}; o1.p = 'foo'; o1.p;",
            //    "var o2 = {}; o2.p = 42; o2.p;",
            //    "var o3 = {}; o3.p;",
            //    "var o4 = {}; o4.p = 42; o4.p;",
            //    "var o5 = {p: {}}; o5.p = {p: 42}; o5.p.p;",
            //    "var o6 = {p: 42}; o6.p = {p: 42}; o6.p.p;",
            //    "var o7 = {}; o7.p = 42; o7.p = {p: 42}; o7.p.p;"].join("\n")),
            experimentName: "typeCheck:PropertyExists::ObjectFieldLubUnderSubtyping:FunctionPointwiseLub::flowInsensitiveVariables:contextInsensitiveVariables",
            browser: true,
            stdout: false
        });
    });
    describe.skip("Bug hunt", function () {
        this.timeout(30 * 60 * 1000);
        //var file = "fixtures/underscore-singlefile.js";
        //var file = "fixtures/lodash-singlefile.js";
        //var file = "fixtures/lazy.js-singlefile.js";
        var file = "fixtures/debug_source.js";
        playground.play({
            target: new File(file),
            //target: new Source("var v = [[1, 2, 3]];"),
            //target: new Source([
            //    "var o1 = {p: 42}; o1.p = 'foo'; o1.p;",
            //    "var o2 = {}; o2.p = 42; o2.p;",
            //    "var o3 = {}; o3.p;",
            //    "var o4 = {}; o4.p = 42; o4.p;",
            //    "var o5 = {p: {}}; o5.p = {p: 42}; o5.p.p;",
            //    "var o6 = {p: 42}; o6.p = {p: 42}; o6.p.p;",
            //    "var o7 = {}; o7.p = 42; o7.p = {p: 42}; o7.p.p;"].join("\n")),
            experimentName: "none::FunctionIntersection:ObjectFieldLubUnderSubtyping",
            browser: false,
            stdout: true
        });
    });
});