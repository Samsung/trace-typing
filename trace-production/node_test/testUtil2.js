/*
 * Copyright 2014 Samsung Information Systems America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Author: Esben Andreasen

var jalangiInterface = require("../src/JalangiInterface");
var instrumentFile = jalangiInterface.instrumentFile,
    path = require('path'),
    astUtil = jalangiInterface.astUtil,
    acorn = require("acorn"),
    fs = require('fs'),
    Q = require("q");

var hasRunWithoutSubprocess = false;

/**
 * Instruments and analyses a script.
 * @param {string} script the script to test
 * @param {Array.<string>} analysisLocations the analyses to run (should be produced with path.resolve)
 * @param {string} [instScriptFile] file in which to store the instrumented script
 * @param {Array.<string>} [script_args] additional CLI arguments to pass to script
 * @param {object} [syntacticSupportCheckerVisitor] exception-throwing AST-visitor for rejecting files based on unsupported syntactic constructs
 * @param {function?} [iidFileCallback] function to report iidFileLocation to (a hack)
 * @return promise|Q.promise promise that resolves when testing is completed, yielding no value, but will
 * be rejected if any assertion fails.  Caller *must* handle reject or failure will be swallowed.
 */
function runTest(script, analysisLocations, instScriptFile, script_args, injectASTInfo, syntacticSupportCheckerVisitor, dirIIDFile) {
    // capture normal output
    if (!script_args) {
        script_args = [];
    }

    // preprocess to reject unsupported syntactic cases
    var ast = acorn.parse(String(fs.readFileSync(path.resolve(script)), {locations: true}));
    astUtil.transformAst(ast, undefined, syntacticSupportCheckerVisitor, astUtil.CONTEXT.RHS);
    var instResult = instrumentFile(script, {outputFile: instScriptFile, dirIIDFile: dirIIDFile}, injectASTInfo);

    var deferred = Q.defer();
    try {
        jalangiInterface.headers.headerSources.forEach(function (src) {
            require(jalangiInterface.jalangiDirectory + '/' + src);
        });
        analysisLocations.forEach(function (e) {
            require(path.resolve(e));
            if (J$.analysis.reset) {
                J$.analysis.reset();
            } else {
                if (hasRunWithoutSubprocess) {
                    throw new Error("Can not run multiple times without subprocesses, at least one analysis does not have reset-functionality: " + e);
                }
            }

        });
        J$.Constants.isSingleTestProcess = true;
        var resolvedInstrumented = path.resolve(instResult.outputFile);
        delete require.cache[resolvedInstrumented]; // important if the same file is used multiple times during testing!
        require(resolvedInstrumented);
        J$.endExecution();
        deferred.resolve();
    } catch (e) {
        deferred.reject(e);
    } finally {
        hasRunWithoutSubprocess = true;
    }

    return deferred.promise;
}

exports.runTest = runTest;
