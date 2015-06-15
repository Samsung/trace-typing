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
///<reference path="../typings/node/node.d.ts"/>
///<reference path="./types.d.ts"/>

import fs = require('fs');
import path = require('path');
var readline = require('readline');
var mkdirp = require('mkdirp');
var stream = require('stream');

import AST = require('./TraceLanguageAST');
import ConfigLoader = require('./ConfigLoader');
import VariableManager = require('./VariableManager');
import SourceLocationImpl = require("./SourceLocationImpl");

interface FileMTimePair {
    file: string
    mtime: Date
}
interface ErrStringFunc {
    (err:any, str:string): void
}

interface StringPredicate {
    (str:string): boolean
}

export function deserializeNaiveTrace(externalTrace:any[], smap:any):Trace {
    function getCoerceType(type:string):AST.CoerceTypes {
        switch (type) {
            case "Object":
                return AST.CoerceTypes.Object;
            case "Boolean":
                return AST.CoerceTypes.Boolean;
            case "Number":
                return AST.CoerceTypes.Number;
            case "String":
                return AST.CoerceTypes.String;
            case "Null":
                return AST.CoerceTypes.Null;
            case "Undefined":
                return AST.CoerceTypes.Undefined;
            default:
                throw new Error("Unhandled coerce type: " + type);
        }
    }


    var mkVar = VariableManager.mkVar;

    var statements:TraceStatement[] = <TraceStatement[]>externalTrace.map(function deserializeElement(e:any):TraceElement {
        var p = e.properties;
        var meta:TraceElementMetaInformation = {iid: e.meta.iid + ''};
        switch (e.kind) {
            case "WRITE":
                var rhs:TraceExpression = <TraceExpression>deserializeElement(p.sourceExpression);
                return new AST.WriteImpl(mkVar(p.sinkTmp), rhs, meta);
            case "FIELD_WRITE":
                return new AST.FieldWriteImpl(mkVar(p.baseTmp), p.fieldName, mkVar(p.sourceTmp), p.isInitializer, meta);
            case "DELETE":
                return new AST.DeleteImpl(mkVar(p.baseTmp), p.fieldName, meta);
            case "INFO":
                var infoKind:AST.InfoKinds = (<any>{
                    FUNCTION_INVOCATION: AST.InfoKinds.FunctionInvocation,
                    FUNCTION_ENTER: AST.InfoKinds.FunctionEnter,
                    FUNCTION_RETURN: AST.InfoKinds.FunctionReturn,
                    FUNCTION_RESULT: AST.InfoKinds.FunctionResult,
                    COERCION: AST.InfoKinds.Coerce,
                    NEXT_FIELD_ACCESS_IS_DYNAMIC: AST.InfoKinds.NextFieldAccessIsDynamic,
                    NEXT_NEW_IS_ARRAY: AST.InfoKinds.NextNewIsArray,
                    NEXT_NEW_IS_ARGUMENTS: AST.InfoKinds.NextNewIsArguments,
                    NEXT_NEW_IS_FUNCTION: AST.InfoKinds.NextNewIsFunction,
                    FOR_IN_OBJECT: AST.InfoKinds.ForInObject,
                    NEXT_NEW_IS_DOT_PROTOTYPE: AST.InfoKinds.NextNewIsDotPrototype
                })[p.kind];
                var infoProperties:InfoProperties;
                switch (infoKind) {
                    case AST.InfoKinds.FunctionInvocation:
                    /* fallthrough */
                    case AST.InfoKinds.FunctionEnter:
                        infoProperties = {
                            functionTmp: mkVar(p.functionTmp),
                            baseTmp: mkVar(p.baseTmp),
                            argsTmps: p.argsTmps.map(mkVar),
                            isConstructorCall: p.isConstructorCall
                        };
                        break;
                    case AST.InfoKinds.FunctionReturn:
                    /* fallthrough */
                    case AST.InfoKinds.FunctionResult:
                        infoProperties = {resultTmp: mkVar(p.resultTmp)};
                        break;
                    case AST.InfoKinds.Coerce:
                        infoProperties = {
                            sourceTmp: mkVar(p.sourceTmp),
                            sinkTmp: mkVar(p.sinkTmp),
                            type: getCoerceType(p.type)
                        };
                        break;
                    case AST.InfoKinds.NextFieldAccessIsDynamic:
                    case AST.InfoKinds.NextNewIsDotPrototype:
                    case AST.InfoKinds.NextNewIsArray:
                    case AST.InfoKinds.NextNewIsArguments:
                    /* fallthrough */
                    case AST.InfoKinds.NextNewIsFunction:
                        infoProperties = {};
                        break;
                    case AST.InfoKinds.ForInObject:
                        infoProperties = {
                            sourceTmp: mkVar(p.sourceTmp)
                        };
                        break;
                    default:
                        throw new Error("Unhandled info kind: " + infoKind);
                }

                return new AST.InfoImpl(infoKind, infoProperties, meta);
            case "READ":
                return new AST.ReadImpl(mkVar(p.sourceTmp), meta);
            case "FIELD_READ":
                var modelingHack:ModelingHack;
                if (p.modelingHack && p.modelingHack.fieldReadPrimitiveResultTmp) {
                    modelingHack = {fieldReadPrimitiveResultTmp: mkVar(p.modelingHack.fieldReadPrimitiveResultTmp)};
                } else {
                    modelingHack = undefined
                }
                return new AST.FieldReadImpl(mkVar(p.baseTmp), p.fieldName, modelingHack, meta);
            case "NEW":
                return new AST.NewImpl(mkVar(p.prototypeTmp), meta);
            case "PRIMITIVE":
                var primitiveKind:AST.PrimitiveKind = (<any>{
                    string: AST.PrimitiveKind.String,
                    number: AST.PrimitiveKind.Number,
                    boolean: AST.PrimitiveKind.Boolean,
                    null: AST.PrimitiveKind.Null,
                    undefined: AST.PrimitiveKind.Undefined
                })[p.value];
                if (primitiveKind === undefined) {
                    throw new Error("Unhandled primitive kind: " + p.value);
                }
                return new AST.PrimitiveImpl(primitiveKind, meta);
            default:
                throw new Error("Unhandled trace element kind: " + e.kind);
        }

    });
    return {statements: statements, iidMap: makeSIIDMap(smap), sources: extractSources(smap)};
}
function extractSources(externalSIIDMap:any[]):string[] {
    var sources:string[] = [];
    for (var sid in externalSIIDMap) {
        if (!isNaN(parseInt(sid))) {
            var orig2instrumentedMapping = externalSIIDMap[1];
            sources[sid] = externalSIIDMap[sid].originalCodeFileName;
        }
    }
    return sources;
}
function makeSIIDMap(externalSIIDMap:any):IIDMap {
    if (externalSIIDMap === undefined) {
        throw new Error("undefined externalSIIDMap?!");
    }
    var iidMap = new Map<string, any>();
    for (var sid in externalSIIDMap) {
        if (!isNaN(parseInt(sid))) {
            var iids = externalSIIDMap[sid];
            var originalCodeFileName = iids.originalCodeFileName;
            var defaultKey = sid + '/-1';
            iidMap.set(defaultKey, new SourceLocationImpl(originalCodeFileName, -1, -1, -1, -1));
            for (var iid in iids) {
                if (!isNaN(parseInt(sid))) {
                    var iidTuple = iids[iid];
                    iidMap.set(sid + '/' + iid, new SourceLocationImpl(originalCodeFileName, iidTuple[0], iidTuple[2], iidTuple[1], iidTuple[3]));
                }
            }
        }
    }
    var wrapper:any = {};

    wrapper.get = function (k:string) {
        if (!wrapper.has(k)) {
            console.error("No such iid registered: %s (type: %s)", k, typeof k);
            // FIXME workaround for unfinished TODO at jalangi2/src/js/runtime/analysis.js:437!!
            var sidAndIid:[string, string] = <[string, string]>k.split("/");
            var workaroundIid = parseInt(sidAndIid[1]) - 2;
            var sid = sidAndIid[0];
            var workaroundKey = sid + "/" + workaroundIid;
            if (wrapper.has(workaroundKey)) {
                var workaroundLocation = wrapper.get(workaroundKey);
                console.log("Returning workaround location for Jalangi bug: " + JSON.stringify(workaroundLocation));
                return workaroundLocation;
            }
            var defaultLocation = wrapper.get(sid + '/-1');
            console.log("Returning default location: " + JSON.stringify(defaultLocation));
            return defaultLocation;
        }
        return iidMap.get(k);
    };
    wrapper.has = (k:string) => iidMap.has(k);
    return wrapper;
}
function makeParser(importProcessor:TraceImportFunc):ErrStringFunc {
    return function (err:any, fileName:string) {
        if (err) {
            throw err;
        }
        if (!fs.existsSync(fileName)) {
            throw new Error("No such file: " + fileName);
        }
        fs.readFile(fileName, 'utf8', function (err, traceFileContent) {
            if (err) {
                importProcessor(err, undefined);
            }
            var parsed:ParsedTraceFile = <ParsedTraceFile>JSON.parse(traceFileContent);
            var deserialized:TraceImport = {
                date: parsed.date,
                trace: undefined
            };

            switch (parsed.format) {
                case "naive":
                    var statementsFile = parsed.statementsFile;

                    var instream = fs.createReadStream(statementsFile);
                    var outstream = new stream;
                    var rl = readline.createInterface(instream, outstream);
                    var statements:any[] = [];
                    rl.on('line', function (line:string) {
                        statements.push(JSON.parse(line));
                    });

                    rl.on('close', function () {
                        deserialized.trace = deserializeNaiveTrace(statements, parsed.smap);
                        importProcessor(undefined, deserialized);
                    });
            }
        });
    }
}

export class TraceImporter {

    private traceDirectory:string;

    constructor() {
        this.traceDirectory = ConfigLoader.load().tracesDirectory;
        if (!fs.existsSync(this.traceDirectory)) {
            mkdirp.sync(this.traceDirectory);
        }
    }

    getAllTraceFiles():string[] {
        var names = fs.readdirSync(this.traceDirectory);
        var files = names.filter(function (name) {
            var suffix = ".trace";
            return name.indexOf(suffix) === name.length - suffix.length
        }).map(function (name) {
            return this.traceDirectory + "/" + name;
        }, this);
        return files;
    }

    private getAllTraceFileNames():string[] {
        return fs.readdirSync(this.traceDirectory);
    }

    importAll(traceImportsFunc:TraceImportsFunc) {
        var files = this.getAllTraceFileNames();
        if (files.length === 0) {
            traceImportsFunc(undefined, []);
        }

        var all:TraceImport[] = [];
        var visited = 0;
        for (var i = 0; i < files.length; i++) {
            makeParser(function (err, traceImport) {
                all.push(traceImport);
                visited++;
                if (visited === files.length) {
                    traceImportsFunc(undefined, all);
                }
            })(undefined, this.traceDirectory + "/" + files[i]);
        }
    }

    import(file:string, traceImportFunc:TraceImportFunc) {
        makeParser(traceImportFunc)(undefined, file);
    }
}
export interface TraceImportFunc {
    (err:any, traceImport:TraceImport): void
}
export interface TraceImportsFunc {
    (err:any, traceImports:TraceImport[]): void
}
