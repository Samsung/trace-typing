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
var misc = require("./misc");
var traceElements = require("./traceElements");
var elementKinds = traceElements.elementKinds;
var infoKinds = traceElements.infoKinds;

var assert = misc.assert;

function walkTrace(trace, visitor) {
    for (var i = 0; i < trace.length; i++) {
        traceElements.walkElement(trace[i], visitor);
    }
}

function checkTraceConsistency(trace) {
    var undefinednessVisitor = (function () {
        function checkUndefined() {
            var properties = JSON.stringify(arguments);
            "";//"[" + Array.prototype.slice.call(arguments, 0).join(", ") + "]";
            for (var i = 0; i < arguments.length; i++) {
                assert(arguments[i] !== undefined, "undefined value in trace element[" + i + "]: " + properties)
                if (arguments[i] instanceof Array) {
                    try {
                        checkUndefined.apply(undefined, arguments[i]);
                    } catch (e) {
                        assert(false, "undefined value in trace element[" + i + "]: [" + arguments[i].join(",") + "] in " + properties);
                    }
                }
            }
        }

        var undefinednessVisitor = {};
        traceElements.visitorMethodNames.forEach(function (methodName) {
            undefinednessVisitor[methodName] = checkUndefined
        });
        return undefinednessVisitor;
    })();
    walkTrace(trace, undefinednessVisitor);
    var defBeforeUseVisitor = (function () {
        var defUseVisitor = {
            visitPreWrite: function () {
                return {def: [], use: []};
            },
            visitPostWrite: function (sinkTmp, souceExpression) {
                return {def: [sinkTmp], use: []};
            },
            visitFieldWrite: function (baseTmp, fieldName, sourceTmp) {
                return {def: [], use: [baseTmp, sourceTmp]};
            },
            visitDelete: function (baseTmp, fieldName) {
                return {def: [], use: [baseTmp]};
            },
            visitInfo: function (msg) {
                return {def: [], use: []};
            },
            visitRead: function (sourceTmp) {
                return {def: [], use: [sourceTmp]};
            },
            visitNew: function (prototypeTmp) {
                return {def: [], use: [prototypeTmp]};
            },
            visitPrimitive: function (value) {
                return {def: [], use: []};
            }
        };
        var defBeforeUseVisitor = {};
        var globalDefs = new Set();
        // quick hack to not depend on tmpUtil in traceBuilder...
        globalDefs.add("magic:global");
        traceElements.visitorMethodNames.forEach(function (methodName) {
            defBeforeUseVisitor[methodName] = function () {
                var defUse = defUseVisitor[methodName].apply(undefined, arguments);
                var use = defUse.use;
                var def = defUse.def;
                var argumentsArray = Array.prototype.slice.call(arguments);
                use.forEach(function (u) {
                    assert(globalDefs.has(u), "Temporary use before def: " + JSON.stringify(u) + " (at " + methodName + "(" + JSON.stringify(argumentsArray) + "))");
                });
                def.forEach(function (d) {
                    globalDefs.add(d)
                });
            }
        });
        return defBeforeUseVisitor;
    })();
    walkTrace(trace, defBeforeUseVisitor);
}
exports.checkTraceConsistency = checkTraceConsistency;
