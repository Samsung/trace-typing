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
var jalangiInterface = require("../src/JalangiInterface");
var testUtil = require('../node_test/testUtil2'),
    astUtil = jalangiInterface.astUtil,
    astUtilForTracing = require('./astUtilForTracing'),
    path = require("path"),
    temp = require("temp"),
    fs = require("fs"),
    Q = require("q");

function run(target, exportFileOrFunction, debug) {
    var exportFile;
    var exportFunctionWrapper;
    if (exportFileOrFunction !== undefined) {
        if (typeof exportFileOrFunction === 'string') {
            exportFile = exportFileOrFunction;
            exportFunctionWrapper = undefined;
        } else if (typeof exportFileOrFunction === 'function') {
            exportFile = temp.path();
            exportFunctionWrapper = function () {
                return Q.nfcall(fs.readFile, exportFile, {encoding: "utf8"}).then(function (content) {
                    var parsed = JSON.parse(content);
                    var statements = fs.readFileSync(parsed.statementsFile, 'utf8');
                    exportFileOrFunction(undefined, statements.split('\n').map(function (l) {
                        return JSON.parse(l)
                    }), parsed.smap);
                }).fail(function (err) {
                    exportFileOrFunction(err, undefined, undefined);
                });
            };
        }
    }

    function makeASTInfo(instAST) {
        var astInfo = {
            lazyBooleanLocations: astUtilForTracing.computeLazyBooleanLocations((instAST)),
            constantRightArguments: astUtilForTracing.computeConstantRightArguments((instAST)),
            dynamicPropertyDeleteNames: astUtilForTracing.computeDynamicPropertyDeleteNames((instAST)),
            methodCallArgumentCounts: astUtilForTracing.computeMethodCallArgumentCounts((instAST)),
            parameterCounts: astUtilForTracing.computeParameterCounts((instAST)),
            voidedExpressions: astUtilForTracing.computeVoidedExpressions((instAST)),
            globalVariableDeclarations: astUtilForTracing.computeGlobalVariableDeclarations((instAST)),
            functionDeclarations: astUtilForTracing.computeFunctionDeclarations((instAST)),
            forInVariableUpdates: astUtilForTracing.computeForInVariableUpdates((instAST))
        };
        return astInfo;
    }

    function injectASTInfo(instResult) {
        var prefix = "(function (sandbox) {\n" +
            "sandbox.ast_info = " + JSON.stringify(makeASTInfo(instResult.instAST)) + ";\n" +
            "}(typeof J$ === 'undefined' ? J$ = {} : J$));";
        return prefix + "\n" + instResult.code;
    }

    var syntacticSupportChecker = {
        "Identifier": function (node) {
            if (node.name === 'eval') {
                throw new Error('eval not supported for tracing:');
            }
        },
        "Property": function (node) {
            if (node.kind === 'get' || node.kind === 'set') {
                throw new Error('getters and setters are not supported');
            }
        },
        "ForInStatement": function (node) {
            if (node.left.type !== 'VariableDeclaration' && node.left.type !== 'Identifier') {
                throw new Error('only simple for-in variables are supported');
            }
        },
        "WithStatement": function (node) {
            throw new Error('with-usage is not supported');
        }
    }

    var chainedAnalyses = require("./JalangiInterface").ChainedAnalyses;
    var analysis = path.resolve(__dirname + "/Tracing.js");
    var analyses;

    if (debug) {
        analyses = [chainedAnalyses, analysis];
    } else {
        analyses = [analysis];
    }

    var jalangi = require("jalangi2");

    function analysisDone(options) {
        var exitCode = options.exitCode;
        var stdout = options.stdout;
        var stderr = options.stderr;
        var result = options.result;
        if (stderr) {
            console.error(stderr);
        }
        if (stdout) {
            console.log(stdout);
        }
        if (exitCode !== 0) {
            console.log(stdout);
            throw stderr;
        } else {
            if (exportFunctionWrapper) {
                return exportFunctionWrapper();
            }
        }
    };
    var instrumentationDir = require("../src/ConfigLoader").load().instrumentationDirectory;
    var outputDir = instrumentationDir;
    return jalangi.instrumentDir({
        inputFiles: [target.dir || target.main] /* instrument directory or single file */,
        outputDir: outputDir,
        astHandler: makeASTInfo,
        inlineIID: true
    }).then(
        function (options) {
            var resolvedAnalyses = analyses.map(function (f) {
                return path.resolve(f)
            });
            return jalangi.analyze(options.outputDir + (target.dir ? "/" + path.basename(target.dir) + "/" : "/") + path.basename(target.main), resolvedAnalyses, {
                debug: !!debug,
                exportFile: exportFile
            });
        }
    ).then(analysisDone, analysisDone).fail(function (e) {
            throw e;
        });
}
exports.run = run;
