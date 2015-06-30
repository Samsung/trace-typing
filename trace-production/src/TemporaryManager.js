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
// Author: Esben Andreasen
/**
 * Manager for the temporaries used during trace recording.
 *
 * Maintains a stack of temporaries that can be used for tracking flow of values without using shadow values
 */
var misc = require("./misc");
var assert = misc.assert;
function isPrimitive(val) {
    var type = typeof val;
    return type === "string" || type === "number" || type === "boolean" || type === "undefined" || val === null;
}

var DEBUG = J$.initParams.debug === 'true';
// hack to avoid X1'ing values that we need later
// TODO replace with ASTQueries...
var DUMMY_NO_VALUE = "DUMMY_NO_VALUE";
function TemporaryManager(contextState, astQueries, traceBuilder, nativeSynthesisManager) {
    function describeValue(value) {
        return DEBUG ? "((" + (isPrimitive(value) ? (typeof value === "string" ? '"' + value + '"' : value ) : ('%' + typeof value + '%')) + "))" : "";
    }

    function log(msg) {
        if (DEBUG) {
            // console.log("TemporaryManager::: " + msg);
        }
    }

    var hiddenShadowStacks = [];
    var shadowStack = [];
    var shadowStackDescriptionMemory = new Map();

    function isSingleAssignmentTemporary(tmp) {
        return false;
        return tmp.match(/expr:\d+/);
    }


    /**
     * Assumes the shadow stack has information for a function call in the order: [... function, base, argument0, ..., argumentN] (TOP)
     * If the shadow stack is empty - then the call is made from uninstrumented code.
     */
    function popFunctionCallTemporaries(f, base, args, isCalledFromExternal) {
        var iid = contextState.getCurrentIID();
        var baseTmp, functionTmp, argsTmps;
        if (isCalledFromExternal) {
            // call is made from uninstrumented code, make some new temporaries
            functionTmp = nativeSynthesisManager.fromNative(f, iid);
            baseTmp = nativeSynthesisManager.fromNative(base, iid);
            argsTmps = [];
            for (var i = 0; i < args.length; i++) {
                argsTmps.push(nativeSynthesisManager.fromNative(args[i], iid));
            }
        } else {
            argsTmps = this.popValueTmps(args.length, args);
            functionTmp = this.popValueTmp(f);
            baseTmp = this.popValueTmp(base);
        }
        return {functionTmp: functionTmp, baseTmp: baseTmp, argsTmps: argsTmps};
    }

    this.popFunctionCallTemporaries = popFunctionCallTemporaries;
    /**
     * The mirror of popFunctionCallTemporaries
     */
    function pushFunctionCallTemporaries(f, base, args, tmps) {
        this.pushValueTmp(tmps.baseTmp, base);
        this.pushValueTmp(tmps.functionTmp, f);
        assert(args.length === tmps.argsTmps.length);
        for (var i = 0; i < args.length; i++) {
            this.pushValueTmp(tmps.argsTmps[i], args[i]);
        }
    }

    this.pushFunctionCallTemporaries = pushFunctionCallTemporaries;
    var popValueTmp = function (value /* for debugging only!! */) {
        if (shadowStack.length === 0) {
            var giid = J$.sid + ":" + contextState.getCurrentIID();
            var loc = J$.iidToLocation(giid);
            assert(false, 'Popping of empty shadowStack at' + loc + '!');
        }
        var tmp = shadowStack.pop();

        assert(tmp !== DUMMY_NO_VALUE, "Popping " + DUMMY_NO_VALUE + " in order to use it?!")

        log("popping: " + tmp + " " + describeValue(value));

        if (DEBUG && isSingleAssignmentTemporary(tmp)) {
            var oldDescription = shadowStackDescriptionMemory.get(tmp);
            var currentDescription = describeValue(value);
            var symbolicPattern = /\(\("\*[^*]+\*"\)\)/;
            if (!oldDescription.match(symbolicPattern) && !currentDescription.match(symbolicPattern)/* ignore the symbolic cases */) {
                assert(oldDescription === currentDescription, "Single assignment temporary " + tmp + " has changed its value: " + oldDescription + " --> " + currentDescription);
            }
        }
        return tmp;
    };

    /*
     * Pops a number of temporaries of the shadow stack - and returns them in the order they were put on!
     */
    this.popValueTmps = function (count, values /* for debugging only!! */) {
        var tmps = [];
        for (var i = count - 1; i >= 0; i--) {
            tmps[i] = popValueTmp(values[i]);
        }
        return tmps;
    };
    this.pushValueTmps = function (tmps, values /* for debugging only!! */) {
        for (var i = 0; i < tmps.length; i++) {
            this.pushValueTmp(tmps[i], values[i]);
        }
    };
    this.makeUnknownTemporaryDescriptions = function (count) {
        var descriptions = [];
        for (var i = 0; i < count; i++) {
            descriptions.push("*UNKNOWN*")
        }
        return descriptions;
    }

    this.popValueTmp = popValueTmp;

    this.popEndExpressionValueTmp = function () {
        if (shadowStack.length === 0) {
            assert(false, 'Popping of empty shadowStack!');
        }
        var popped = shadowStack.pop();
        log("popping: " + popped + " (at top-level expression)");
    }

    this.pushDummyEndExpressionTmp = function () {
        log("pushing: " + DUMMY_NO_VALUE + " (at top-level expression)");
        shadowStack.push(DUMMY_NO_VALUE);
    }

    this.pushValueTmp = function (tmp, value /* for debugging only!! */, isIIDExpressionResult, ignoreVoidHack) {
        if(DEBUG) {
            if (typeof tmp !== 'string') {
                assert(false, "Wrong type for temporary: " + tmp);
            }
            if (isIIDExpressionResult && (tmp.indexOf("expr") !== 0)) {
                assert(false, "Trying to push result, but it is not a result-temporary!?")
            }
        }
        if (isIIDExpressionResult && astQueries.isDynamicPropertyDeleteName(J$.sid, contextState.getCurrentIID())) {
            log("NOT pushing dynamic property delete name: " + tmp + " " + describeValue(value));
        } else if (!ignoreVoidHack && isIIDExpressionResult && astQueries.isVoidedExpression(J$.sid, contextState.getCurrentIID())) {
            // this would be much easier if void was a case in analysis.unary ... but Koushik says some DOM eventhandlers break if void is a unary operator...
            log("NOT pushing voided expression value, pushing 'undefined' instead: " + tmp + " " + describeValue(value))
            var resultTmp = this.getResultTmp();
            traceBuilder.makePrimitiveStatement(undefined, resultTmp, contextState.getCurrentScopeID());
            this.pushValueTmp(resultTmp, undefined, true, true);
        } else {
            log("pushing: " + tmp + " " + describeValue(value));
            shadowStack.push(tmp);
            if (DEBUG && isSingleAssignmentTemporary(tmp) && !shadowStackDescriptionMemory.has(tmp) /* redefinitions ignored for now */) {
                shadowStackDescriptionMemory.set(tmp, describeValue(value));
            }
        }
    };

    // NB: all these formats are parsed in trace-typing!
    this.getIntermediaryTmp = function (name) {
        var siid = J$.sid + "/" + contextState.getCurrentIID();
        return "intermediary:" + siid + "-" + name + ':' + contextState.getCurrentScopeID();
    };
    this.getResultTmp = function () {
        var siid = J$.sid + "/" + contextState.getCurrentIID();
        return "expr:" + siid + ':' + contextState.getCurrentScopeID();
    };
    this.getMergeTmp = function (name) {
        var siid = J$.sid + "/" + contextState.getCurrentIID();
        return "merge:" + siid + "-" + name + ':' + contextState.getCurrentScopeID();
    };
    this.getVarTmp = function (name) {
        return "var:" + name + ":" + contextState.getScopeIDForVariable(name);
    };
    this.getThisTmp = function () {
        return this.getVarTmp('this');
    };
    this.getGlobalTmp = function () {
        return "magic:" + traceBuilder.externals._Global;
    };
    this.getScopeID = function () {
        return contextState.getCurrentScopeID();
    };
    this.checkEmptyShadowStack = function () {
        assert(shadowStack.length === 0, "shadow stack non-empty: " + shadowStack);
    };
    this.isShadowStackEmpty = function () {
        return shadowStack.length === 0;
    };
    this.logStack = function () {
        log(shadowStack);
    };
    this.markCaughtException = function () {
        log("almost emptying shadowstack: [" + shadowStack.join(",") + "]")
        // leave the default return value
        shadowStack.splice(1, shadowStack.length);
    };
    this.markFunctionEntry = function () {
        log("hiding shadowstack: [" + shadowStack.join(",") + "]");
        hiddenShadowStacks.push(shadowStack);
        shadowStack = [];
    };
    this.markFunctionReturn = function () {
        assert(shadowStack.length <= 1, "shadow stack should be empty (or have default return value tmp) on function return: [" + shadowStack.join(",") + "]");
        assert(hiddenShadowStacks.length > 0, "no shadow stacks left?!?!")
        shadowStack = hiddenShadowStacks.pop();
        log("restoring shadowstack: [" + shadowStack.join(",") + "]");
    };
    this.markFunctionThrow = function () {
        shadowStack = hiddenShadowStacks.pop();
        log("restoring shadowstack: [" + shadowStack.join(",") + "]");
    };
}

exports.TemporaryManager = TemporaryManager;
