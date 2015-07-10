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
 * Builds a trace as a sequence of statements.
 */

var misc = require("./misc");
var traceElements = require("./traceElements");
var elementKinds = traceElements.elementKinds;
var infoKinds = traceElements.infoKinds;

var assert = misc.assert;
var DEBUG = J$.initParams.debug === 'true';
function TraceBuilder(exportFunction) {
    var externals = {
        _Global: "global"
    };

    var traceLength = 0;
    return {
        externals: externals,
        register: function (element) {
            traceLength++;
            exportFunction(element);
            if (DEBUG) {
                // n^2 complexity to do this every time the trace is extended...
                //checkTraceConsistency(trace);
            }
        },
        makeWriteStatement: function (sinkTmp, sourceExpression, iid) {
            this.register(
                {
                    kind: elementKinds.WRITE, meta: {iid: J$.sid + "/" + iid}, properties: {
                    sinkTmp: sinkTmp,
                    sourceExpression: sourceExpression
                }
                }
            );
        },
        infoBuilder: {
            register: function (element) {
                // copy of the other register!
                traceLength++;
                exportFunction(element);
            },
            makeFunctionInvocation: function (functionTmp, baseTmp, argsTmps, isConstructorCall, isExternalCall, iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.FUNCTION_INVOCATION,
                        functionTmp: functionTmp,
                        baseTmp: baseTmp,
                        argsTmps: argsTmps,
                        isConstructorCall: isConstructorCall,
                        isExternalCall: isExternalCall
                    }
                });
            },
            makeFunctionEnter: function (functionTmp, baseTmp, argsTmps, scopeID, iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.FUNCTION_ENTER,
                        functionTmp: functionTmp,
                        baseTmp: baseTmp,
                        argsTmps: argsTmps,
                        scopeID: scopeID
                    }
                });
            },
            makeFunctionReturn: function (returnTmp, iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.FUNCTION_RETURN,
                        resultTmp: returnTmp
                    }
                });
            },
            makeFunctionResult: function (resultTmp, iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.FUNCTION_RESULT,
                        resultTmp: resultTmp
                    }
                });
            },
            makeCoercion: function (sourceTmp, type, sinkTmp, iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.COERCION,
                        sourceTmp: sourceTmp,
                        sinkTmp: sinkTmp,
                        type: type
                    }
                });
            },
            makeNextFieldAccessIsDynamic: function (iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.NEXT_FIELD_ACCESS_IS_DYNAMIC
                    }
                });
            },
            makeNextNewIsArray: function (iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.NEXT_NEW_IS_ARRAY
                    }
                });
            },
            makeNextNewIsArguments: function (iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.NEXT_NEW_IS_ARGUMENTS
                    }
                });
            },
            makeNextNewIsFunction: function (iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.NEXT_NEW_IS_FUNCTION
                    }
                });
            },
            makeNextNewIsDotPrototype: function (iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.NEXT_NEW_IS_DOT_PROTOTYPE
                    }
                });
            },
            makeForInObject: function (objectTmp, iid) {
                this.register({
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid}, properties: {
                        kind: infoKinds.FOR_IN_OBJECT,
                        sourceTmp: objectTmp
                    }
                });
            }
        },
        makeMoveStatement: function (sinkTmp, sourceTmp, iid) {
            if (sinkTmp === undefined) {
                throw new Error("sinkTmp undef");
            }
            if (sourceTmp === undefined) {
                throw new Error("sourceTmp undef");
            }
            this.makeWriteStatement(sinkTmp, {
                kind: elementKinds.READ, meta: {iid: J$.sid + "/" + iid}, properties: {
                    sourceTmp: sourceTmp
                }
            }, iid);
        },
        makeFieldWriteStatement: function (baseTmp, fieldName, sourceTmp, isInitializer, iid) {
            this.register(
                {
                    kind: elementKinds.FIELD_WRITE, meta: {iid: J$.sid + "/" + iid}, properties: {
                    baseTmp: baseTmp,
                    fieldName: fieldName + '' /* coerce to string */,
                    sourceTmp: sourceTmp,
                    isInitializer: isInitializer
                }
                }
            );
        },
        makeDeleteStatement: function (baseTmp, fieldName, iid) {
            this.register(
                {
                    kind: elementKinds.DELETE, meta: {iid: J$.sid + "/" + iid}, properties: {
                    baseTmp: baseTmp,
                    fieldName: fieldName + ''
                }
                });
        },
        makeInfoStatement: function (msg, iid) {
            this.register(
                {
                    kind: elementKinds.INFO, meta: {iid: J$.sid + "/" + iid},
                    properties: {msg: msg}
                }
            );
        },
        makeFieldReadStatement: function (baseTmp, fieldName, sinkTmp, modelingHack, iid) {
            var expression = {
                kind: elementKinds.FIELD_READ, meta: {iid: J$.sid + "/" + iid},
                properties: {
                    baseTmp: baseTmp,
                    fieldName: "" + fieldName /*coerce to string*/,
                    modelingHack: modelingHack
                }
            };
            this.makeWriteStatement(sinkTmp, expression, iid);
        },
        makeNewStatement: function (prototypeTmp, sinkTmp, iid) {
            var expression = {
                kind: elementKinds.NEW, meta: {iid: J$.sid + "/" + iid}, properties: {
                    prototypeTmp: prototypeTmp
                }
            };
            this.makeWriteStatement(sinkTmp, expression, iid);
        },
        makePrimitiveStatement: function (value, sinkTmp, iid) {
            var representation;
            if (value === null) {
                representation = "null";
            } else {
                representation = typeof value;
            }
            var expression = {
                kind: elementKinds.PRIMITIVE, meta: {iid: J$.sid + "/" + iid}, properties: {value: representation}
            };
            this.makeWriteStatement(sinkTmp, expression, iid);
        }
    }
};

exports.TraceBuilder = TraceBuilder;
