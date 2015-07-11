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

function countUniqueIIDs(messages:IIDRelatedMessage[]) {
    var seen = new Set<string>();
    var count = 0;
    messages.forEach((m:IIDRelatedMessage) => {
        var iid = m.iid;
        if (seen.has(iid)) {
            return;
        }
        seen.add(m.iid);
        count++;
    });
    return count;
}

export function testTrace(err:any, trace:Trace, expectedErrorCount:number, inferencerConfig:InferencerConfig, done:Function, flowConfig:PrecisionConfig, typeSystemDescription?:string, enableSJSChecks:boolean = false) {
    if (err) {
        done(err);
        throw err;
    }
    try {
        // TODO refactor some of this to separate file
        // console.log("Trace replay...");
        var traceReplayResults = TraceReplayer.replayTrace(trace);
        var typeLatticePair = inferencerConfig();

        var explainer = new MetaInformationExplainerImpl(trace.iidMap);
        var results = TypedTraceReplayer.replayTrace(traceReplayResults.variableValues, traceReplayResults.variableList, trace.statements, flowConfig, typeLatticePair, explainer);
        // console.log("Type checking...");
        var messages:TypeChecker.IIDRelatedConstaintFailureMessage[] = TypeChecker.check(trace.statements, results.propagatedEnv, results.inferredEnv, typeLatticePair.types, undefined, enableSJSChecks);
        var noTransitiveDependencies = false;
        if (noTransitiveDependencies) {
            messages = messages.filter(m => {
                var location = explainer.getIIDSourceLocation(m.iid).file;
                var pattern = /(\/node_modules\/.*\/node_modules\/)/;
                return !pattern.test(location);
            });
        }
        var iidErrors = messages.filter(m => m.type === 'error');
        var iidWarnings = messages.filter(m => m.type === 'warning');

        var dynamicErrorCount = iidErrors.length;

        var result:TypeChecksResult = {kind: PersistentResults.ExperimentResultKinds.TypeChecksResult, data: {}};
        for (var k in TypeChecker.ConstraintKinds) {
            if (!isNaN(parseInt(k))) {
                var relevantMessages = messages.filter(m => m.constraintKind === parseInt(k));
                var dynamicMessageCount = relevantMessages.length;
                var staticMessageCount = countUniqueIIDs(relevantMessages);
                result.data[k] = {
                    Dynamic: dynamicMessageCount,
                    Static: staticMessageCount
                }
            }
        }
        // console.log("Output...");
        var description = (typeSystemDescription ? typeSystemDescription : "Some type system") + " w. " + JSON.stringify(flowConfig);
        var annotated = PersistentResults.annotate([result], trace.sources, description);
        PersistentResults.save(annotated, function () {
            if (true || expectedErrorCount !== -1) {
                var show = false && expectedErrorCount !== dynamicErrorCount;
                if (dynamicErrorCount > 0 && show) {
                    var showErrorsAndWarnings = true;
                    var showLocation = true;
                    if (showErrorsAndWarnings) {
                        function location(e:IIDRelatedMessage) {
                            return showLocation ? explainer.getIIDSourceLocation(e.iid) + ": " : ""
                        }

                        iidErrors.forEach(e => console.log("%sError (kind:%s): %s", location(e), TypeChecker.ConstraintKinds[e.constraintKind], e.message));
                        iidWarnings.forEach(e => console.log("%sWarning (kind:%s): %s", location(e), TypeChecker.ConstraintKinds[e.constraintKind], e.message));
                    }
                    var sourceLocationErrors:SourceRelatedMessage[] = iidErrors.map(e => {
                        return {
                            sourceLocation: explainer.getIIDSourceLocation(e.iid),
                            message: e.message,
                            type: e.type
                        };
                    });

                    explainer.displayMessagesInBrowser("Typechecking", sourceLocationErrors, function () {
                        if (expectedErrorCount !== -1) {
                            assert.equal(dynamicErrorCount, expectedErrorCount);
                        }
                        done();
                    });
                } else {
                    if (expectedErrorCount !== -1) {
                        assert.equal(dynamicErrorCount, expectedErrorCount);
                    }
                    done();
                }
            } else {
                done();
            }
        });

    } catch (e) {
        done(e);
        throw e;
    }
}
