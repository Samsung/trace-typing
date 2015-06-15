/*
 * Copyright 2015 Samsung Information Systems America, Inc.
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

/**
 * The Main analysis for recording execution traces.
 */
var CoercionUtil = require("./CoercionUtil").CoercionUtil,
    FakeCoercionUtil = require("./CoercionUtil").FakeCoercionUtil,
    TraceBuilder = require("./TraceBuilder").TraceBuilder,
    IIDAwareTraceBuilder = require("./TraceBuilder").IIDAwareTraceBuilder,
    CompositeAnalysis = require("./CompositeAnalysis").CompositeAnalysis,
    ContextAnalysis = require("./ContextAnalysis").ContextAnalysis,
    TemporaryManager = require("./TemporaryManager").TemporaryManager,
    coerceTypes = require("./traceElements").coerceTypes,
    TraceBuildingAnalysis = require("./TraceBuildingAnalysis").TraceBuildingAnalysis,
    ASTQueries = require("./ASTQueries").ASTQueries,
    fakes = require("./fakes"),
    TraceCollectionController = require("./TraceCollectionController"),
    NativeSynthesisManager = require("./NativeSynthesisManager"),
    fakes = require("./fakes"),
    fs = require("fs"),
    temp = require("temp");


var savedSandbox = undefined;
var registeredAnalysis = undefined;
(function (sandbox) {
    registeredAnalysis = new CompositeAnalysis();
    savedSandbox = sandbox;
    reset();
    sandbox.analysis = registeredAnalysis;
    sandbox.analysis.reset = reset;
})(J$);

function reset() {
    var astQueries = new ASTQueries(savedSandbox);

    var contextAnalysis = new ContextAnalysis();

    var statementsFile = J$.initParams.exportFile + '.statements';

    // TODO implement proper stream interface?
    var statementStreamer = (function () {
        var fileWriter = fs.createWriteStream(statementsFile);
        var first = true;
        var length = 0;
        var localBuffer = [];
        var ended = false;

        function flush() {
            var separator = '\n';
            if (!first) {
                fileWriter.write(separator);
            }
            first = false;
            fileWriter.write(localBuffer.map(function (e) {
                return JSON.stringify(e)
            }).join(separator));
            localBuffer.length = 0;
        }

        return {
            write: function (e) {
                localBuffer.push(e);
                if (localBuffer.length > 10000) {
                    flush();
                }
                length++;
                if (length % 100000 === 0) {
                    // console.log("Trace length: %d", length);
                }
            },
            end: function (cb) {
                if(ended){
                    console.warn("Still receiving (asynchronous) statements after end...");
                    return;
                }
                ended = true;
                flush();
                fileWriter.end(function () {
                    cb();
                });
            }
        };
    })();

    var traceBuilder = new TraceBuilder(statementStreamer.write);
    // traceBuilder = new fakes.FakeTraceBuilder();

    var nativeSynthesisManager = new NativeSynthesisManager(traceBuilder);
    var coercionCounter = 0;
    var coercionUtil = new CoercionUtil(function () {
        return temporaryManager.getIntermediaryTmp("coercion" + coercionCounter++);
    }, traceBuilder, coerceTypes, nativeSynthesisManager);
    // coercionUtil = new fakes.FakeCoercionUtil();

    // contextAnalysis = new fakes.FakeContextAnalysis();

    var temporaryManager = new TemporaryManager(contextAnalysis.contextState, astQueries, traceBuilder, nativeSynthesisManager);
    nativeSynthesisManager.init(temporaryManager);
    // temporaryManager = new fakes.FakeTemporaryManager();

    var traceCollectionController = new TraceCollectionController.TraceCollectionController(temporaryManager, statementStreamer.end, statementsFile, contextAnalysis.contextState);


    var traceBuildingAnalysis = new TraceBuildingAnalysis(temporaryManager, astQueries, contextAnalysis.contextState, coercionUtil, traceBuilder, traceCollectionController, nativeSynthesisManager);
    registeredAnalysis.setAnalyses(contextAnalysis.analysisPre, new CompositeAnalysis(traceBuildingAnalysis, contextAnalysis.analysisPost))
}
