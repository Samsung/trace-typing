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
    ASTQueries = require('./ASTQueries'),
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
            exportFile = temp.path({suffix: ".trace"});
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
        if (stderr) {
            console.error(stderr);
        }
        if (stdout) {
            console.log(stdout);
        }
        if (exitCode !== 0) {
            throw new Error("Exit code === %d", options.exitCode);
        } else {
            if (exportFunctionWrapper) {
                return exportFunctionWrapper();
            }
        }
    };
    var instrumentationDir = require("../src/ConfigLoader").load().instrumentationDirectory;
    var outputDir = instrumentationDir;
    var inputFiles = [target.dir || target.main].map(function(f){return path.resolve(f);});
    return jalangi.instrumentDir({
        inputFiles: inputFiles /* instrument directory or single file */,
        outputDir: outputDir,
        astHandler: ASTQueries.makeASTInfo,
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
