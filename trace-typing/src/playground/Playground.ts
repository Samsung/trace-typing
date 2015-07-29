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
///<reference path="../types.d.ts"/>
///<reference path="../../typings/node/node.d.ts"/>
///<reference path="../../typings/mocha/mocha.d.ts"/>

import assert = require("../../test/assert-async-mocha");
import TraceMaker = require("../TraceMaker");
import TraceImporter = require("../TraceImporter");
import TypeImpls = require("../typing/TypeImpls");
import TypeChecker = require("../typing/TypeChecker");
import TraceReplayer = require("../trace-replaying/TraceReplayer");
import TypedTraceReplayer = require("../trace-replaying/TypedTraceReplayer");
import State = require("../trace-replaying/State");
import TypeInferencer = require("../typing/TypeInferencer");
import VariableManager = require("../VariableManager");
import PersistentResults = require("../PersistentResults");
import MetaInformationExplainerImpl = require("../MetaInformationExplainer");
import Configs = require("../experiments/Configs");
import util = require('util');

enum PlayTargetKind {
    source,
    file,
    trace
}
interface PlayTarget {
    kind: number // enum: PlayTargetKind
}

export class PlaySourceTarget implements PlayTarget {
    public kind = PlayTargetKind.source;

    constructor(public source:string) {
    }
}

export class PlayFileTarget implements PlayTarget {
    public kind = PlayTargetKind.file;
    public target:Target;

    constructor(main:string, dir?:string) {
        this.target = {main: main, dir: dir};
    }

}

export class PlayTraceTarget implements PlayTarget {
    public kind = PlayTargetKind.trace;

    constructor(public trace:string) {
    }

}

interface PlayInfo {
    iid: string
}
interface PlayFailureInfo extends PlayInfo {
    message: string
}

interface PlayTypeInfo extends PlayInfo {
    type: TupleType
}

interface PlayExperimentResult {
    types:PlayTypeInfo[]
    failures:PlayFailureInfo[]
}
interface PlayExperiment {
    (trace:Trace): PlayExperimentResult
}

interface PlayAsserts {
    assert: (value:any, message:string) => void
    equal: <T>(actual:T, expected:T, message:string) => void
    deepEqual:  <T>(actual:T, expected:T, message:string) => void
}
interface PlayCallback {
    (failures:PlayTypeInfo[], types:PlayFailureInfo[], asserts:PlayAsserts): void
}
interface PlayConfig {
    target: PlayTarget
    experimentName: string
    callback?: PlayCallback
    description?: string
    stdout?: boolean
    browser?: boolean
    iidFilter?: string[]
}

interface PlayExperiments {
    [name:string]: (trace:Trace)=>PlayExperimentResult
}

function makeDescription(config:PlayConfig) {
    if (config.description) {
        return config.description;
    }
    var targetDescription:string;
    switch (config.target.kind) {
        case PlayTargetKind.source:
            var source = (<PlaySourceTarget>config.target).source;
            var firstLineBreak = source.indexOf("\n");
            var maxLength = 20;
            var shownLength = firstLineBreak !== -1 ? Math.min(firstLineBreak, maxLength) : Math.min(source.length, maxLength);
            targetDescription = source.substring(0, shownLength) + (shownLength !== source.length ? " ..." : "");
            break;
        case PlayTargetKind.file:
            var target = (<PlayFileTarget>config.target).target;
            targetDescription = (target.dir ? target.dir + " w. " : "") + target.main;
            break;
        case PlayTargetKind.trace:
            targetDescription = (<PlayTraceTarget>config.target).trace;
            break;
        default:
            throw new Error("Unhandled PlayTargetKind: " + config.target.kind);
    }
    return config.experimentName + "(" + targetDescription + ")";
}

export class Playground {

    private static omss = ['ObjectFieldEquality', 'ObjectFieldLubUnderSubtyping'];
    private static fmss = ['FunctionIntersection', 'FunctionPointwiseLub'];
    private static mmss:string[] = ['UnionTypes'];
    private static ps = ['flowInsensitiveVariables', 'contextInsensitiveVariables'];
    private static inspections = ['typeCheck', 'none'];

    constructor() {

    }

    private static getExperimentName(inspection:string, oms:string, fms:string, mmss:string[], ps:string[]) {
        var precisionString = ps && ps.length > 0 ? "::" + ps.join(":") : "";
        var miscString = mmss && mmss.length > 0 ? ":" + mmss.join(":") : "";
        return util.format("%s::%s:%s%s%s", inspection, oms, fms, miscString, precisionString);
    }

    static getExampleExperimentName() {
        return Playground.getExperimentName(Playground.inspections[0], Playground.omss[0], Playground.fmss[0], [Playground.mmss[0]], [Playground.ps[0]]);
    }

    static getAPIExplanationString() {
        var res = "";
        res += "Experiment name structure: Inspection::ObjectLatice:FunctionLattice[:MiscLattice*][::[:Precision]*]\n";
        res += "\n";
        res += "Inspections:\n";
        res += Playground.inspections.map(i => "\t" + i).join("\n");
        res += "\n";
        res += "Object lattices:\n";
        res += Playground.omss.map(i => "\t" + i).join("\n");
        res += "\n";
        res += "Function lattices:\n";
        res += Playground.fmss.map(i => "\t" + i).join("\n");
        res += "\n";
        res += "Misc. lattices:\n";
        res += Playground.mmss.map(i => "\t" + i).join("\n");
        res += "\n";
        res += "Precision:\n";
        res += Playground.ps.map(i => "\t" + i).join("\n");
        return res;
    }

    playWithoutTest(playConfig:PlayConfig, done:Function) {
        function traceCallback(err:any, trace:Trace) {
            if (err) {
                done(err);
                return;
            }
            try {
                var playAsserts:PlayAsserts = {
                    assert: function (value:any, message:string) {
                        assert.assert(value, done, message, true);
                    },
                    equal: function <T>(actual:T, expected:T, message:string) {
                        assert.equal(actual, expected, done, message, true);
                    },
                    deepEqual: function <T>(actual:T, expected:T, message:string) {
                        assert.equal(actual, expected, done, message, true);
                    }
                };
                var experimentNameParts:string[] = playConfig.experimentName.split("::");
                var experimentConfig = new Configs.ExperimentStringConfig(experimentNameParts[1].split(":"), experimentNameParts.length >= 3 ? experimentNameParts[2].split(":") : []);
                var experiment:PlayExperiment;
                var inspection = experimentNameParts[0].split(":");
                var inspectionName = inspection[0];
                var inspectionArgs = inspection.slice(1);
                switch (inspectionName) {
                    case 'none':
                        experiment = function (trace:Trace):PlayExperimentResult {
                            var traceReplayResults = TraceReplayer.replayTrace(trace);

                            var typeLatticePair:ValueTypeConfig = experimentConfig.typeLatticeMaker();

                            TypedTraceReplayer.replayTrace(traceReplayResults.variableValues, traceReplayResults.variableList, trace.statements, experimentConfig.precisionConfig, typeLatticePair, new MetaInformationExplainerImpl(trace.iidMap));
                            return {
                                types: <any>[],
                                failures: <any>[]
                            };
                        };
                        break;
                    case 'typeCheck':
                        experiment = function (trace:Trace):PlayExperimentResult {
                            var traceReplayResults = TraceReplayer.replayTrace(trace);

                            var typeLatticePair:ValueTypeConfig = experimentConfig.typeLatticeMaker();
                            var results = TypedTraceReplayer.replayTrace(traceReplayResults.variableValues, traceReplayResults.variableList, trace.statements, experimentConfig.precisionConfig, typeLatticePair, new MetaInformationExplainerImpl(trace.iidMap));

                            var constraints:TypeChecker.ConstraintKinds[] = inspectionArgs.map(arg => {
                                var typeCheck:TypeChecker.ConstraintKinds = (<any>TypeChecker).ConstraintKinds[arg];
                                if (typeCheck !== undefined) {
                                    return typeCheck
                                } else {
                                    throw new Error("Unsupported typecheck name: " + arg);
                                }

                            });

                            var messages = TypeChecker.check(trace.statements, results.propagatedEnv, results.inferredEnv, typeLatticePair.types, new MetaInformationExplainerImpl(trace.iidMap), constraints);
                            return {
                                types: <any>[],
                                failures: messages
                            };
                        }
                        break;
                    default:
                        throw new Error("No unhandled inspection type: " + inspection);
                }

                var result = experiment(trace);
                var types = result.types;
                var failures = result.failures;
                if (playConfig.iidFilter) {
                    var iids = new Set();
                    playConfig.iidFilter.forEach(iid => iids.add(iid));
                    function iidFilter(info:PlayInfo):boolean {
                        return iids.has(info.iid);
                    }

                    types = types.filter(iidFilter);
                    failures = failures.filter(iidFilter);
                }

                if (playConfig.callback) {
                    try {
                        playConfig.callback(types, failures, playAsserts);
                    } catch (e) {
                        done(e);
                        return;
                    }
                }

                function formatSourceLocationMessage(iid:string, message:string) {
                    return trace.iidMap.get(iid).toString(true, false) + " (iid: " + iid + "): " + message;
                }

                function formatType(type:TupleType):string {
                    return TypeImpls.toPrettyString(type, true);
                }


                function locationOrder(l1:SourceLocation, l2:SourceLocation):number {
                    var fileCmp = l1.file.localeCompare(l2.file);
                    if (fileCmp !== 0) {
                        return fileCmp;
                    }
                    var beginLineCmp = l1.beginLine - l2.beginLine;
                    if (beginLineCmp !== 0) {
                        return beginLineCmp;
                    }
                    var beginColumnCmp = l1.beginColumn - l2.beginColumn;
                    if (beginColumnCmp !== 0) {
                        return beginColumnCmp;
                    }
                    var endLineCmp = l1.endLine - l2.endLine;
                    if (endLineCmp !== 0) {
                        return endLineCmp;
                    }
                    var endColumnCmp = l1.endColumn - l2.endColumn;
                    if (endColumnCmp !== 0) {
                        return endColumnCmp;
                    }
                    return 0;
                }

                function playTypeInfoLocationOrder(i1:PlayTypeInfo, i2:PlayTypeInfo):number {
                    return locationOrder(trace.iidMap.get(i1.iid), trace.iidMap.get(i2.iid));
                }

                function playFailureInfoLocationOrder(i1:PlayFailureInfo, i2:PlayFailureInfo):number {
                    return locationOrder(trace.iidMap.get(i1.iid), trace.iidMap.get(i2.iid));
                }


                if (playConfig.stdout) {
                    if (types.length > 0) {
                        types.sort(playTypeInfoLocationOrder);
                        console.log("Type information:");
                        types.forEach(info => console.log("    " + formatSourceLocationMessage(info.iid, formatType(info.type))));
                        console.log();
                    } else {
                        console.log("No type information...");
                    }
                    if (failures.length > 0) {
                        failures.sort(playFailureInfoLocationOrder);
                        console.log("Failure information (%d entries):", failures.length);
                        failures.forEach(info => console.log("    " + formatSourceLocationMessage(info.iid, info.message)));
                        console.log();
                    } else {
                        console.log("No failure information...");
                    }
                }
            } catch (e) {
                done(e);
                return;
            }

            if (playConfig.browser) {
                console.log("Opening browser...");
                var messages:SourceRelatedMessage[] = [];
                messages = messages.concat(types.map(info => ({
                    message: formatType(info.type) + (" ((iid: " + info.iid + "))"),
                    sourceLocation: trace.iidMap.get(info.iid),
                    type: "info"
                })));
                messages = messages.concat(failures.map(info => ({
                    message: info.message + (" ((iid: " + info.iid + "))"),
                    sourceLocation: trace.iidMap.get(info.iid),
                    type: "error"
                })));
                new MetaInformationExplainerImpl(trace.iidMap).displayMessagesInBrowser(makeDescription(playConfig), messages, done)
            } else {
                done();
                return;
            }
        }

        switch (playConfig.target.kind) {
            case PlayTargetKind.source:
                TraceMaker.getTraceFromSource((<PlaySourceTarget>playConfig.target).source, traceCallback);
                break;
            case PlayTargetKind.file:
                TraceMaker.getTraceFromDir((<PlayFileTarget>playConfig.target).target, traceCallback);
                break;
            case PlayTargetKind.trace:
                new TraceImporter.TraceImporter().import((<PlayTraceTarget>playConfig.target).trace, function (err:any, imported:TraceImport) {
                    if (err) {
                        done(err);
                        return;
                    }
                    traceCallback(undefined, imported.trace);
                });
                break;
            default:
                throw new Error("Unhandled PlayTargetKind: " + playConfig.target.kind);
        }
    }

    public play(config:PlayConfig):void {
        var thiz = this;
        it("Should make <" + makeDescription(config) + "> play nice.", function (done) {
            thiz.playWithoutTest(config, done);
        });
    }
}
