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
 * Analysis that records facts about the execution context.
 */
var misc = require("./misc");
var isPrimitive = misc.isPrimitive;
var assert = misc.assert;
var NODEJS_ENVIRONMENT = true;

function ContextAnalysis(astUtil) {
    var callLocationStack = [],
        scriptStack = [],
        enteredScopeOwnerStack = [], /* stack of functions, either actual user-space functions, or dummy functions for representing module scopes */
        callTypeStack = [],
        currentIID = undefined,
        nextFunctionEnterIsInternal = false,
        nextFunctionEnterIsConstructor = false,
        instrumentedFunctions = typeof WeakSet === 'undefined' /* old nodejs compatibility hack*/ ? new Set() : new WeakSet(),
        functionEnclosingScopes = typeof WeakMap === 'undefined' /* old nodejs compatibility hack*/ ? new Map() : new WeakMap(), // used for setting up scopes
        scopes = typeof WeakMap === 'undefined' /* old nodejs compatibility hack*/ ? new Map() : new WeakMap(),
        scopeCreationCounts = {}; // (scope iid -> count), i.e. (num -> num)

    function peek(array) {
        assert(array.length > 0, 'Peeking at empty stack!')
        return array[array.length - 1];
    }

    function incrementScopeCreationCount(iid) {
        if (scopeCreationCounts[iid] === undefined) {
            scopeCreationCounts[iid] = 0;
        }
        scopeCreationCounts[iid]++;
    }

    function deleteCurrentScope() {
        return scopes.get(peek(enteredScopeOwnerStack)).pop();
    }

    function getCurrentScope() {
        var scopeOwner = peek(enteredScopeOwnerStack);
        var scope = peek(scopes.get(scopeOwner));
        assert(scope !== undefined, "Undefined scope!?");
        return scope;
    }

    var contextState = {
        isCallStackEmpty: function () {
            return callLocationStack.length === 0;
        },
        isScriptStackEmpty: function () {
            return scriptStack.length === 0;
        },
        getCurrentIID: function () {
            return currentIID;
        },
        isCalledFromExternal: function () {
            return !peek(callTypeStack).internal;
        },
        isCalledAsConstructor: function () {
            assert(peek(callTypeStack).internal, "peeking for constructornesss at call made from external code...");
            return peek(callTypeStack).constructor;
        },
        isExternalFunction: function (f) {
            return !instrumentedFunctions.has(f);
        },
        getCurrentScopeID: function(){
            return getCurrentScope().id;
        },
        getScopeIDForVariable: function (name) {
            var scope = getCurrentScope();
            while (scope !== undefined) {
                if (scope.declarations.has(name)) {
                    return scope.id;
                }
                scope = scope.enclosing;
            }
            throw new Error("Variable not found in any scopes?!! (" + name + " at " + contextState.getCurrentIID() + ")");
        }
    }

    this.contextState = contextState;
    this.analysisPre = new AnalysisPre();
    this.analysisPost = new AnalysisPost();

    function AnalysisPost() {
        this.invokeFunPre = function (iid, f, base, args, isConstructor, isMethod) {
            callLocationStack.push(iid);
        }
        this.functionExit = function (iid, returnVal, exceptionVal) {
            deleteCurrentScope();
            callTypeStack.pop();
            enteredScopeOwnerStack.pop();
        }
    }

    function makeModuleScope(iid) {
        var scope = makeScope(iid, undefined);

        if (NODEJS_ENVIRONMENT) {
            scope.declarations.add('global');
            scope.declarations.add('this');
            scope.declarations.add('module');
            scope.declarations.add('exports');
            scope.declarations.add('require');
            scope.declarations.add('__dirname');
            scope.declarations.add('__filename');
        }

        return scope;
    }

    function makeInvocationScope(iid, f) {
        var enclosing = functionEnclosingScopes.get(f);

        var scope = makeScope(iid, enclosing);

        scope.declarations.add('this');

        return scope;
    }

    function makeScope(iid, enclosingScope) {
        incrementScopeCreationCount(iid);
        // NB: this format is parsed in trace-typing!
        var scopeID = iid + ':' + scopeCreationCounts[iid];

        var scope = {
            id: scopeID,
            declarations: new Set(),
            enclosing: enclosingScope
        };

        return scope;
    }

    function AnalysisPre() {
        this.invokeFunPre = function (iid, f, base, args, isConstructor, isMethod) {
            currentIID = iid;
            if(typeof f === 'function') {
                if (!contextState.isExternalFunction(f)) {
                    nextFunctionEnterIsInternal = true;
                    nextFunctionEnterIsConstructor = isConstructor;
                }
                if ((f === Function.prototype.call || f === Function.prototype.apply) && !contextState.isExternalFunction(base)) {
                    nextFunctionEnterIsInternal = true;
                    nextFunctionEnterIsConstructor = false;
                }
            }else{
                // about to fail on invocation
            }
        };

        this.invokeFun = function (iid, f, base, args, result, isConstructor, isMethod) {
            currentIID = iid;
            callLocationStack.pop();
        };

        this.literal = function (iid, val, hasGetterSetter) {
            currentIID = iid;
            if (typeof val === 'function') {
                instrumentedFunctions.add(val);
                functionEnclosingScopes.set(val, getCurrentScope());
                scopes.set(val, []);
            }
        };

        this.forinObject = function (iid, val) {
            currentIID = iid;
        };

        this.declare = function (iid, name, val, isArgument, argumentIndex, isCatchParam) {
            currentIID = iid;
            // FIXME support catch level scopes! (the problem is that there is no callback for when the scope ends! (so the key to scopes is just the function for now))
            getCurrentScope().declarations.add(name); // (relies on Jalangi instrumentation doing declares before references...)
        };

        this.getFieldPre = function (iid, base, offset) {
            currentIID = iid;
        };

        this.getField = function (iid, base, offset, val) {
            currentIID = iid;
        };

        this.putFieldPre = function (iid, base, offset, val) {
            currentIID = iid;
        };

        this.putField = function (iid, base, offset, val) {
            currentIID = iid;
        };

        this.read = function (iid, name, val, isGlobal, isPseudoGlobal) {
            currentIID = iid;
        };

        this.write = function (iid, name, val, lhs, isGlobal, isPseudoGlobal) {
            currentIID = iid;
        };

        this.functionEnter = function (iid, f, dis, args) {
            currentIID = iid;
            if (nextFunctionEnterIsInternal) {
                callTypeStack.push({
                    internal: nextFunctionEnterIsInternal,
                    constructor: nextFunctionEnterIsConstructor
                });
                nextFunctionEnterIsConstructor = false;
                nextFunctionEnterIsInternal = false;
            } else {
                callTypeStack.push({internal: false, constructor: undefined});
            }
            enteredScopeOwnerStack.push(f);
            var scope = makeInvocationScope(iid, f);
            scopes.get(f).push(scope);
        };

        this.functionExit = function (iid, returnVal, exceptionVal) {
            currentIID = iid;
        };

        this.scriptEnter = function (iid, val) {
            currentIID = iid;
            scriptStack.push(J$.sid);

            if (NODEJS_ENVIRONMENT) {
                function dummyScopeFunction() {
                }

                enteredScopeOwnerStack.push(dummyScopeFunction);
                var scope = makeModuleScope(iid);
                scopes.set(dummyScopeFunction, [scope]);
            }else{
                throw new Error("Non-nodejs environments not supported for now...");
            }
        };

        this.scriptExit = function (iid, exceptionVal) {
            currentIID = iid;
            scriptStack.pop();
            enteredScopeOwnerStack.pop();
        };

        this.binaryPre = function (iid, op, left, right) {
            currentIID = iid;
        };

        this.binary = function (iid, op, left, right, result) {
            currentIID = iid;
        };

        this.unaryPre = function (iid, op, left) {
            currentIID = iid;
        };

        this.unary = function (iid, op, left, result) {
            currentIID = iid;
        };

        this.conditional = function (iid, result) {
            currentIID = iid;
        };
    }
}

exports.ContextAnalysis = ContextAnalysis;
