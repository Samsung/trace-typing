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
var fs = require('fs');
var traceElements = require('./traceElements');
var DEBUG = J$.initParams.debug === 'true';
var checkTraceConsistency = require("./TraceConsistencyChecker").checkTraceConsistency;
function stop(end, statementsFile, exportFile) {
    end(function () {
        if (DEBUG) {
            var statementStrings = fs.readFileSync(statementsFile, 'utf8').split("\n");
            var statements = statementStrings.map(function (statementString) {
                return JSON.parse(statementString);
            });
            checkTraceConsistency(statements);
            var i = 0;
            statements.forEach(function (statement) {
                // console.log(i++ + "::: " + traceElements.elementToString(statement));
            });
        }
        if (exportFile) {
            // assumes a file system is available!
            var TraceExporter = require("./TraceExporter").TraceExporter;
            new TraceExporter().export(statementsFile, J$.smap, exportFile);
        }
    });
}

function TraceCollectionController(tmpManager, end, statementsFile, contextState, exportFile) {
    return {
        maybeStop: function (exceptionVal) {
            if (contextState.isCallStackEmpty() && contextState.isScriptStackEmpty()) {
                if (DEBUG) {
                    if (!exceptionVal) {
                        tmpManager.checkEmptyShadowStack();
                    }
                }
                stop(end, statementsFile, exportFile);
            }
        },
        forceStop: function () {
            stop(end, statementsFile);
        }
    }
}

exports.TraceCollectionController = TraceCollectionController;
