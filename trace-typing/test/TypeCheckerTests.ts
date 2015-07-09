///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../src/types.d.ts"/>

import assert = require("assert");
import path = require("path");
import fs = require("fs");
import util = require('util');

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
import ConfigLoader = require("../src/ConfigLoader");
var inferenceConfigs = (function () {
    return {
        fullIntersection: TypeLattices.makeFullIntersection,
        simpleSubtyping: TypeLattices.makeSimpleSubtyping,
        simpleSubtypingWithUnion: TypeLattices.makeSimpleSubtypingWithUnion,
        SJS: TypeLattices.makeSJS
    };
})();

function testFile(file:string, expectedErrorCount:number, inferencerConfig:InferencerConfig, done:Function, flowConfig:PrecisionConfig) {
    TraceMaker.getTraceFromSourceFile(file, function (err:any, trace:Trace) {
        TypeCheckerTester.testTrace(err, trace, expectedErrorCount, inferencerConfig, done, flowConfig);
    });
}
function testSource(source:string, expectedErrorCount:number, inferencerConfig:InferencerConfig, done:Function, flowConfig:PrecisionConfig) {
    TraceMaker.getTraceFromSource(source, function (err:any, trace:Trace) {
        TypeCheckerTester.testTrace(err, trace, expectedErrorCount, inferencerConfig, done, flowConfig);
    });
}
describe("TypeChecker unit tests", function () {
    this.timeout(5 * 1000);
    describe("sanityChecks", function () {
        var config = inferenceConfigs.fullIntersection; // choice is not important

        it('Should not find errors for empty program', function (done) {
            testSource("", 0, config, done, {});
        });
        it('Should not find errors for primitive program', function (done) {
            testSource("2 + 2;", 0, config, done, {});
        });
        it('Should allow valid property access', function (done) {
            testSource("({p: 42}).p", 0, config, done, {});
        });
        it('Should disallow invalid property access', function (done) {
            testSource("({}).p", 1, config, done, {});
        });
        it('Should allow allocations', function (done) {
            testSource("({})", 0, config, done, {});
        });
        it('Should allow function allocations', function (done) {
            testSource("(function(){})", 0, config, done, {});
        });
        it('Should allow function invocations', function (done) {
            testSource("(function(){})()", 0, config, done, {});
        });
        it('Should allow variable assignments', function (done) {
            testSource("(function(){ var a = 42; })()", 0, config, done, {});
        });
        it('Should allow variable redefinitions', function (done) {
            testSource("(function(){ var a = 42; a = 'foo';})()", 0, config, done, {});
        });
        it('Should allow valid property access through variable', function (done) {
            testSource("(function(){var o = {p: 42}; o.p})()", 0, config, done, {});
        });
        it('Should find true error', function (done) {
            testSource("({}).p", 1, config, done, {});
        });
        it('Should allow method invocation', function (done) {
            var config = inferenceConfigs.simpleSubtyping;
            var flowConfig = {flowInsensitiveVariables: true};
            testSource("" +
                "String.prototype.f = function () {};" +
                "String.prototype.f();",
                -1, config, done, flowConfig);
        });
    });
    describe("custom tests", function () {
        describe("fullIntersection", function () {
            var config = inferenceConfigs.fullIntersection;
            it('Should allow reassignment of property', function (done) {
                testSource("(function(){var o = {p: 87}; o.p = 42; o.p;})()", 0, config, done, {});
            });
            it('Should find nested intersection-caused error', function (done) {
                testSource("(function(){var o = {p: {}}; o.p = {p: 42}; o.p.p;})()", 1, config, done, {});
            });
        });
        describe("flow sensistive variables", function () {
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {flowInsensitiveVariables: false};
            it('Should allow reassignment of property #1', function (done) {
                testSource("(function(){var o = {p: 87}; var v = 'foo'; v = 42; o.p = v; o.p;})()", 0, config, done, flowConfig);
            });
            it('Should allow reassignment of property #2', function (done) {
                testSource("(function(){var o = {p: 87}; var v = 42; v = 'foo'; o.p = v; o.p;})()", 0, config, done, flowConfig);
            });
        });
        describe("flow insensistive variables & default initialization", function () {
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {flowInsensitiveVariables: true};
            it('Should find error in reassignment of property #1', function (done) {
                testSource("(function(){var o = {p: 42}; o.p;})()", 0, config, done, flowConfig);
            });
        });
        describe("flow insensistive variables", function () {
            var config = inferenceConfigs.simpleSubtyping;
            var flowConfig = {flowInsensitiveVariables: true};
            it('Should find error in reassignment of property #1', function (done) {
                testSource("(function(){var o = {p: 87}; var v = 'foo'; v = 42; o.p = v; o.p;})()", 1, config, done, flowConfig);
            });
            it('Should find error in reassignment of property #2', function (done) {
                testSource("(function(o, v){v = 42; o.p = v; o.p;})({p: 87}, 'foo')", 1, config, done, flowConfig);
            });
        });
        describe("context sensistive variables", function () {
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {contextInsensitiveVariables: false};
            it('Should allow reassignment of property #1', function (done) {
                testSource("(function(){ function id(v){return v;} var o = {p: 87}; var v = id('foo'); v = id(42); o.p = v; o.p;})()", 0, config, done, flowConfig);
            });
            it('Should allow reassignment of property #2', function (done) {
                testSource("(function(){ function id(v){return v;} var o = {p: 87}; var v = id(42); v = id('foo'); o.p = v; o.p;})()", 0, config, done, flowConfig);
            });
        });
        describe("context insensistive variables", function () {
            var config = inferenceConfigs.fullIntersection;
            var flowConfig = {contextInsensitiveVariables: true};
            it('Shoud allow calls with different arguments', function (done) {
                testSource("(function(){ function id(v){return v;} id(42); id('foo');})()", 0, config, done, flowConfig);
            });
            it('Should find error in reassignment of property #1', function (done) {
                testSource("(function(){ function id(v){return v;} var o = {p: 87}; var v = id('foo'); v = id(42); o.p = v; o.p;})()", 1, config, done, flowConfig);
            });
            it('Should allow reassignment of property #1', function (done) {
                testSource("(function(){ function id(v){return v;} var o = {p: 87}; var v = id(42); v = id('foo'); o.p = v; o.p;})()", 0, config, done, flowConfig);
            });
        });
        describe("function calls", function () {
            // TODO make tests
        });
        describe("function assignments", function () {
            // TODO make tests
        });
        describe.only("Paper", function () {
            var config = inferenceConfigs.simpleSubtyping;
            var flowConfig = {flowInsensitiveVariables: false, contextInsensitiveVariables: true};
            it('Should handle PaperExample1', function (done) {
                testFile('fixtures/PaperExample1.js', 0, config, done, flowConfig);
            });
        });
        describe("Fixpointing", function () {
            var config = inferenceConfigs.simpleSubtyping;
            var flowConfig = {flowInsensitiveVariables: true, contextInsensitiveVariables: true};
            it('Should fixpoint on same argument', function (done) {
                testSource("function f(v){return v;} f(42); f(42);", 0, config, done, flowConfig);
            });
            it('Should fixpoint on different arguments', function (done) {
                testSource("function f(){} f(42); f('foo');", 0, config, done, flowConfig);
            });
            it('Should fixpoint on different arguments, in context of changing variables', function (done) {
                // type error due to call with Top argument
                testSource("(function(r){function f(v){return v;} f(r); r = f(42); r = f('foo'); r = f(f);})(true);", 1, config, done, flowConfig);
            });
        });
    });
});
interface ErrorAndWarningCounts {
    errors: number
    warnings: number
}

var warningGroup = [TypeChecker.ConstraintKinds.IsNotTop];
// the rest of the violated constraint kinds are errors
var errorGroup:TypeChecker.ConstraintKinds[] = [];
for (var k in TypeChecker.ConstraintKinds) {
    k = parseInt(k);
    if (!isNaN(k)) {
        if (warningGroup.indexOf(k) === -1) {
            errorGroup.push(k);
        }
    }
}

describe("Type check traces and display table", function () {
    var oldBigApps = [/*'gulp', */ 'lodash', 'minimist', 'optparse', /*'express', 'grunt', */ 'lazy.js', 'underscore', /*'coffee-script'*/, 'escodegen'];
    //oldBigApps = [];
    var newBigApps = ['esprima', 'qs', 'typescript', /*'validator',*/'xml2js', 'handlebars'];
    //newBigApps = ['typescript'];

    var bigApps = oldBigApps.concat(newBigApps);
    // `bigApps = ['typescript'];
    describe("Type check everything ", function () {
        this.timeout(5 * 60 * 1000);
        var traceImporter:TraceImporter.TraceImporter = new TraceImporter.TraceImporter();
        traceImporter.getAllTraceFiles().forEach(function (file) {
            var noBigApps = false;
            var onlyBigApps = true;

            if (file.indexOf("JSON_nan_bug") !== -1 || file.indexOf("calls") !== -1 /* ambiguous recursiveness */ || (onlyBigApps && file.indexOf("-bug") !== -1) || (onlyBigApps && !bigApps.some(app => file.indexOf(app) !== -1)) || (noBigApps && bigApps.some(app => file.indexOf(app) !== -1))) {
                return; // ignore
            }
            var allTypes = [
                [inferenceConfigs.simpleSubtypingWithUnion, 'simpleSubtypingWithUnion']
                , [inferenceConfigs.simpleSubtyping, 'simpleSubtyping']
                , [inferenceConfigs.fullIntersection, 'intersection']
//                , [inferenceConfigs.SJS, 'SJS']
            ];
            var allFunctionTypes = [
                [TypeLattices.FunctionTypeLatticeKinds.FunctionIntersection, "IntersectionFunctions", false, false, -1]
                , [TypeLattices.FunctionTypeLatticeKinds.FunctionIntersection, "IntersectionFunctionsWCallStack", false, true, -1]
                , [TypeLattices.FunctionTypeLatticeKinds.FunctionIntersection, "IntersectionFunctionsWCallStack-1", false, true, 1]
                , [TypeLattices.FunctionTypeLatticeKinds.FunctionPointwiseLub, "SingleFunctions", true, false, -1]
            ];

            var allVariableFlowInsensitivities = [
                false
                , true
            ]; // TODO add inflationary
            allTypes.forEach((types:[()=>ValueTypeConfig, string])=> {
                allFunctionTypes.forEach((functionTypes:[TypeLattices.FunctionTypeLatticeKinds, string, boolean, boolean, number])=> {
                    allVariableFlowInsensitivities.forEach(vars => {
                        var flowConfig:PrecisionConfig = {
                            flowInsensitiveVariables: vars,
                            contextInsensitiveVariables: functionTypes[2],
                            callstackSensitiveVariables: functionTypes[3],
                            callstackSensitiveVariablesHeight: functionTypes[4]
                        };
                        var typeSystemDescription = types[1] + ' with ' + functionTypes[1] + " and " + JSON.stringify(flowConfig);
                        it("... in particular: " + path.basename(file) + " " + typeSystemDescription, function (done) {
                            traceImporter.import(file, function (err:any, imported:TraceImport) {
                                if (err) {
                                    done(err);
                                    return;
                                }
                                TypeCheckerTester.testTrace(err, imported.trace, -1, types[0], done, flowConfig, types[1], types[1] === 'SJS');
                            });
                        });
                    });
                });
            });
        });
    });

    it("Make pivot tables", function (done) {
        function countErrorsAndWarnings(results:TypeChecksResult[]):ErrorAndWarningCounts {
            var counts = {errors: 0, warnings: 0};
            console.log("countErrorsAndWarnings");
            results.forEach((r:TypeChecksResult) => {
                console.log(r);
                errorGroup.forEach(e => counts.errors += r.data[e].Static);
                warningGroup.forEach(w => counts.warnings += r.data[w].Static);
            });
            console.log("/countErrorsAndWarnings: ", counts);
            return counts;
        }

        PersistentResults.load(PersistentResults.ExperimentResultKinds.TypeChecksResult, (results:AnnotatedExperimentResults<TypeChecksResult>[])=> {
            results = results.filter(r => r.sources.some(f => f !== null && bigApps.some(a => f.indexOf(a) !== -1)));
            var bySourceCSVLines = new Map<string, string[]>();
            results.forEach((r:AnnotatedExperimentResults<TypeChecksResult>) => {
                // parse the fully qualified source paths for each file
                var source = r.sources.filter(s => s !== null && !!s.match(/\/node_modules\//)).map(s => {
                    var match = s.match(/\/([^/]+)\/node_modules\//);
                    return match[1 /* pick first */];
                })[0 /* index should not matter */];

                if (!bySourceCSVLines.has(source)) {
                    bySourceCSVLines.set(source, []);
                }

                // parse the description format made in TypeCheckerTester.ts (silly)
                var descriptionComponents = r.description.split(' w. ');
                var fullTypeConfig = descriptionComponents[0];
                var shortTypeConfig:string;
                switch (fullTypeConfig) {
                    case 'intersection':
                        shortTypeConfig = 'simple'; // XXX seems like a weird naming mapping?!
                        break;
                    case 'simpleSubtyping':
                        shortTypeConfig = 'subtyping';
                        break;
                    case 'simpleSubtypingWithUnion':
                        shortTypeConfig = 'unions';
                        break;
                    case 'SJS':
                        shortTypeConfig = 'SJS';
                        break;
                    default:
                        throw new Error("Unhandled case: " + fullTypeConfig);
                }

                var precisionConfigObj:PrecisionConfig = JSON.parse(descriptionComponents[1]);
                var kSuffix = (precisionConfigObj.callstackSensitiveVariablesHeight !== -1) ? '-' + precisionConfigObj.callstackSensitiveVariablesHeight : '';
                var contextSensitivity = (precisionConfigObj.contextInsensitiveVariables ? 'none' : precisionConfigObj.callstackSensitiveVariables ? 'stack' + kSuffix : 'full');
                var flowSensitivity = (precisionConfigObj.flowInsensitiveVariables ? 'fi' : 'fs');
                var precisionConfig = util.format("%s %s", flowSensitivity, contextSensitivity);

                var line = util.format('"%s", "%s", "%d";', shortTypeConfig, precisionConfig, countErrorsAndWarnings(r.results).errors);
                console.log('csving: %s', line);
                bySourceCSVLines.get(source).push(line);
            });
            // sort lines for prettyness
            var outDir = ConfigLoader.load().experimentResultDirectory;
            bySourceCSVLines.forEach((lines:string[], source:string) => {
                lines.sort();
                // lines.forEach(l => console.log("  %s", l));
                var filename = path.resolve(outDir, source + "-static-error-counts.csv");
                fs.writeFileSync(filename, lines.join('\n'));
            });

            done();
        });
    });

    it("Display table & charts", function (done) {
        // TODO refactor some of this to separate file
        this.timeout(5 * 60 * 1000);
        PersistentResults.load(PersistentResults.ExperimentResultKinds.TypeChecksResult, (results:AnnotatedExperimentResults<TypeChecksResult>[])=> {
            results = results.filter(r => r.sources.some(f => f !== null && bigApps.some(a => f.indexOf(a) !== -1)));
            function makeTable(location:string, constraintKind:TypeChecker.ConstraintKinds) {
                var rows:string[][] = [];
                groupedBySources_keys.forEach(sources => {
                        var rowData = groupedBySourcesAndThenDescription.get(sources);
                        var row = descriptions.map(description => {
                            var cellData = rowData.get(description);
                            return cellData ? (<any>cellData.data)[constraintKind][location] + '' : "??";
                        });
                        rows.push([path.basename(path.dirname(path.dirname(sources))) + '/' + path.basename(path.dirname(sources))].concat(row));
                    }
                );
                var table:Table = {
                    title: location + ' ' + TypeChecker.ConstraintKinds[constraintKind] + ' failures',
                    headers: ["source"].concat(descriptions.map(desc => desc.replace("flowInsensitiveVariables", "fIV").replace("contextInsensitiveVariables", "cIV"))),
                    rows: rows
                };
                return table;
            }

            function makeStackedGroupedBarCharts(location:string):StackedGroupedBarCharts {
                var groups = [errorGroup, warningGroup];
                var barchartData:BarChartData[] = groupedBySources_keys.map(sources => {
                    var sourceData = groupedBySourcesAndThenDescription.get(sources);
                    var rows = descriptions.map((description:any)=> {
                        var groupData:TypeChecksResult = sourceData.get(description);
                        var row:any[];
                        if (groupData) {
                            var numberRow:number[] = [];
                            groups.forEach(group =>
                                    group.forEach(n => {
                                        var data = groupData.data;
                                        var value:number = (<any>data)[n][location];
                                        numberRow.push(value || 0);
                                    })
                            );

                            row = [description].concat(numberRow);
                        } else {
                            row = [description, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
                        }
                        return row;
                    });
                    var simpleSources:string;
                    var sourceMatch = sources.match(/\/([^/]+)\/node_modules\//);
                    if (sourceMatch) {
                        simpleSources = sourceMatch[1];
                    } else {
                        simpleSources = sources;
                    }
                    var chart:BarChartData = {
                        rows: rows,
                        title: 'Type errors and warnings for ' + simpleSources
                    };
                    return chart;
                });
                var columnDescriptions:{
                    type: string
                    description: string
                }[] = [];
                groups.forEach(group =>
                        group.forEach(n => {
                            columnDescriptions.push({
                                type: 'number',
                                description: TypeChecker.ConstraintKinds[n] + ' ' + location
                            });
                        })
                );

                var columnGroupings = [errorGroup.length, warningGroup.length];
                return {
                    barchartData: barchartData,
                    columnDescriptions: columnDescriptions,
                    columnGroupings: columnGroupings
                };
            }

            var groupedBySourcesAndThenDescription = new Map<string, Map<string, TypeChecksResult>>();
            var groupedBySources_keys:string[] = [];
            results.forEach(ar => {
                ar.sources.sort();
                var key = ar.sources.join(":");
                if (!groupedBySourcesAndThenDescription.has(key)) {
                    groupedBySourcesAndThenDescription.set(key, new Map<string, TypeChecksResult>());
                    groupedBySources_keys.push(key);
                }
                groupedBySourcesAndThenDescription.get(key).set(ar.description, ar.results[0]);
            });

            var descriptions:string[] = [];
            results.forEach(ar => {
                if (descriptions.indexOf(ar.description) === -1) {
                    descriptions.push(ar.description);
                }
            });
            descriptions.sort();

            var locations = ['Static', 'Dynamic'];

            //locations.forEach(location => constraintKinds.forEach(constraintKind => {
            //    var table = makeTable(location, constraintKind);
            //    var lines: string[]= [];
            //    lines.push(table.headers.map(h => '"' + h.replace(/"/g, '') + '"').join(','));
            //    table.rows.forEach(row => lines.push(row.map(cell => '"' + cell.replace(/"/g, '') + '"').join(',')));
            //    var filename = "/Users/e.andreasen/tmp/csvs/" + location + "-" + TypeChecker.ConstraintKinds[constraintKind] + ".csv";
            //    fs.writeFileSync(filename, lines.join('\n'));
            //    console.log("Saved to %s", filename);
            //    //MetaInformationExplainerImpl.displayTableInBrowser(table, function () {
            //    //})
            //}));
            MetaInformationExplainerImpl.displayStackedGroupedBarChartsInBrowser(makeStackedGroupedBarCharts(locations[0]), function () {
                MetaInformationExplainerImpl.displayStackedGroupedBarChartsInBrowser(makeStackedGroupedBarCharts(locations[1]), function () {
                    done();
                });
            });
            //});
        });
    });
});
