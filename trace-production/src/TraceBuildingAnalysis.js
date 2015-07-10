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
 * Jalangi analysis that monitors every event during a concrete execution, and generates a trace from these observations.
 */

var misc = require("./misc");
function isPrimitive(val) {
    var type = typeof val;
    return type === "string" || type === "number" || type === "boolean" || type === "undefined" || val === null;
}
var assert = misc.assert;
var DEBUG = J$.initParams.debug === 'true';
var NODEJS_ENVIRONMENT = true;
var moduleManager = undefined;
function ModuleManager(currentModule) {
    return {
        isModule: function (o) {
            return o === currentModule;
        }
    };
}
var isStrict;
function TraceBuildingAnalysis(tmpManager, astQueries, contextUtil, coercionUtil, traceBuilder, traceCollectionController, nativeSynthesisManager) {
    /**
     * Used for keeping track of objects that are being initialized (by constructors)
     */
    var isBeingInitialized = new WeakSet/*<Object>*/();

    function isGlobalVariable(name, isGlobal, isScriptLocal) {
        var isSyntacticallyGlobalVariable = isGlobal || (isScriptLocal && !NODEJS_ENVIRONMENT);
        var isNodeJSAmbientVariable = (NODEJS_ENVIRONMENT && ('module' === name || 'exports' === name || 'require' === name || '__dirname' === name || '__filename' === name));
        var isECMAAmbientVariable = 'arguments' === name /* FIXME, a reference to arguments in non-node toplevel is a global variable... */ || 'this' === name;
        var isAmbientNonGlobalVariable = (isECMAAmbientVariable || isNodeJSAmbientVariable);
        var result = isSyntacticallyGlobalVariable && !isAmbientNonGlobalVariable;
        return result;
    }

    this.invokeFunPre = function (iid, f, base, args, isConstructor, isMethod) {
        function isExternal(f) {
            return typeof f === 'function' && contextUtil.isExternalFunction(f);
        }
        // console.log("invokeFunPre(%s, %s, %s, %s, %s, %s)", iid, "%" + typeof f + "%", base, args, isConstructor, isMethod);
        var argsTmps = tmpManager.popValueTmps(args.length, args);
        var functionTmp = tmpManager.popValueTmp(f);
        var baseTmp;
        if (isConstructor) {
            if (isMethod) {
                // method constructor call, ignore the base
                tmpManager.popValueTmp(base);
            }
            if (typeof f === 'function') {
                nativeSynthesisManager.allocate(f, undefined, undefined, iid);

                // convention: for constructor calls, the base points to the prototype
                var baseTmp = tmpManager.getIntermediaryTmp("prototype");
                traceBuilder.makeFieldReadStatement(functionTmp, "prototype", baseTmp);
                base = f.prototype;
            } else {
                baseTmp = tmpManager.getIntermediaryTmp("non-function-constructor");
                // about to crash: invoking non-function constructor...
            }
        } else if (isMethod) {
            baseTmp = coercionUtil.toObject(base, tmpManager.popValueTmp(base), iid);
        } else {
            baseTmp = tmpManager.getGlobalTmp();
        }

        var tmps = {functionTmp: functionTmp, baseTmp: baseTmp, argsTmps: argsTmps};
        traceBuilder.infoBuilder.makeFunctionInvocation(tmps.functionTmp, tmps.baseTmp, tmps.argsTmps, isConstructor, isExternal(f), iid);

        if (f === Function.prototype.call || f === Function.prototype.apply) {
            // special calls, requires some argument shuffling...

            if (args.length === 0) {
                args[0] = undefined;
                var undefTmp = tmpManager.getIntermediaryTmp("defaultUndefined");
                traceBuilder.makePrimitiveStatement(undefined, undefTmp);
                tmps.argsTmps = [undefTmp];
            }
            var newBase = args[0];

            var newArgs;
            var newArgsTmps;
            if (f === Function.prototype.call) {
                newArgs = Array.prototype.slice.call(args, 1);
                newArgsTmps = tmps.argsTmps.slice(1);
            } else {
                if (args.length === 1 /* can not be 0 at this point */ || args[1] === undefined || args[1] === null) {
                    args[1] = [];
                }
                newArgs = args[1];
                newArgsTmps = [];
                for (var i = 0; i < newArgs.length; i++) {
                    var unboxedArgTmp = tmpManager.getIntermediaryTmp("unboxed-argument-" + i);
                    traceBuilder.makeFieldReadStatement(tmps.argsTmps[1], i + '', unboxedArgTmp);
                    newArgsTmps[i] = unboxedArgTmp;
                }
            }

            var newFun = base;
            var newFunTmp = tmps.baseTmp;

            var newBaseTmp = tmps.argsTmps[0];

            var newTmps = {
                functionTmp: newFunTmp,
                baseTmp: newBaseTmp,
                argsTmps: newArgsTmps
            };
            tmps = newTmps;
            args = newArgs;
            base = newBase;
            f = newFun;
            traceBuilder.infoBuilder.makeFunctionInvocation(tmps.functionTmp, tmps.baseTmp, tmps.argsTmps, false, isExternal(f), iid);
        }

        tmpManager.pushFunctionCallTemporaries(f, isPrimitive(base) ? "*object*" : base, args, tmps);
        if (isExternal(f)) {
            tmpManager.markFunctionEntry();
            nativeSynthesisManager.toNative(f, tmps.functionTmp, iid);
            nativeSynthesisManager.toNative(base, tmps.baseTmp, iid);
            for (var argNumber in args) {
                var arg = args[argNumber];
                var argTmp = tmps.argsTmps[argNumber];
                nativeSynthesisManager.toNative(arg, argTmp, iid);
            }
            if (nativeSynthesisManager.models.requiresModel(f)) {
                nativeSynthesisManager.models.beginOperation(f, tmps.baseTmp, base, iid);
            }
        } else {
            // see this.functionEnter
        }

        return {f: f, base: base, args: args, skip: false};
    };

    this.invokeFun = function (iid, f, base, args, result, isConstructor, isMethod) {
        var resultTmp = tmpManager.getResultTmp();
        if(isConstructor){
            // TODO: slightly imprecise: a constructor might retur a primitive or some other object...
            isBeingInitialized.delete(result);
        }
        if (f === Function.call) {
            result = this.invokeFun(iid, base, args[0], Array.prototype.slice.call(args, 1), result, false, false);
        } else if (f === Function.apply) {
            if (args.length === 1 /* can not be 0 at this point */ || args[1] === undefined || args[1] === null) {
                args[1] = [];
            }
            result = this.invokeFun(iid, base, args[0], args[1], result, false, false);
        } else {
            // console.log("invokeFun(%s, %s, %s, %s, %s, %s, %s)", iid, f, base, args, result, isConstructor, isMethod);
            if (contextUtil.isExternalFunction(f)) {
                tmpManager.markFunctionReturn();
                var tmps = tmpManager.popFunctionCallTemporaries(f, base, args, false); // they were put on the shadow stack just before the call

                traceBuilder.makeMoveStatement(resultTmp, nativeSynthesisManager.fromNative(result), iid);
                if (nativeSynthesisManager.models.requiresModel(f)) {
                    nativeSynthesisManager.models.endOperation(f, tmps.baseTmp, base, resultTmp, result, tmps.argsTmps, args, iid);
                }
            } else {
                traceBuilder.makeMoveStatement(resultTmp, tmpManager.popValueTmp(result), iid);
            }
            tmpManager.pushValueTmp(resultTmp, result, true);
        }
        var fixedReturn = tmpManager.getIntermediaryTmp("fixed-return");
        traceBuilder.infoBuilder.makeFunctionReturn(resultTmp, iid);
        traceBuilder.infoBuilder.makeFunctionResult(fixedReturn, iid);
        traceBuilder.makeMoveStatement(fixedReturn, resultTmp, iid);
        return {result: result};
    };

    this.literal = function (iid, val, hasGetterSetter) {
        var resultTmp = tmpManager.getResultTmp();
        if(hasGetterSetter){
            throw new Error("getter/setter literals not supported...");
        }
        if (isPrimitive(val)) {
            traceBuilder.makePrimitiveStatement(val, resultTmp, iid);
        } else {

            var literalPropertyNames = [];
            var literalPropertyValues = [];

            if (val instanceof RegExp || val instanceof Function) {
            } else if (typeof val === "object") {
                // order is not important, evaluation-order for property values will be correct in the trace
                var propertyNameOrder = [];
                for (var p in val) {
                    if (Object.prototype.hasOwnProperty.call(val, p)) {
                        propertyNameOrder.push(p);
                    }
                }
                var initializerTmps = tmpManager.popValueTmps(propertyNameOrder.length, propertyNameOrder.map(function (e) {
                    return "*initializer: " + e + "*"; // just a debug description...
                }));
                for (var i = 0; i < propertyNameOrder.length; i++) {
                    var propertyName = propertyNameOrder[i];
                    var initializerTmp = initializerTmps[i];
                    literalPropertyValues.push(initializerTmp);
                    literalPropertyNames.push(propertyName);
                }
            } else {
                if (DEBUG) {
                    assert(false, "Unhandled literal: " + val);
                }
            }

            var allocationTmp = tmpManager.getIntermediaryTmp('literal');
            traceBuilder.makeMoveStatement(allocationTmp, nativeSynthesisManager.allocate(val, literalPropertyNames, undefined, iid), iid)
            for (var i = 0; i < literalPropertyNames.length; i++) {
                traceBuilder.makeFieldWriteStatement(allocationTmp, literalPropertyNames[i], literalPropertyValues[i], true, iid);
            }

            traceBuilder.makeMoveStatement(resultTmp, allocationTmp);
        }
        tmpManager.pushValueTmp(resultTmp, val, true);
        return {result: val};
    };

    this.forinObject = function (iid, val) {
        // ignore the object
        var objectTmp = tmpManager.popValueTmp(val);
        traceBuilder.infoBuilder.makeForInObject(objectTmp, iid);
        // (NB Jalangi1 implementation does not allow us to assign to the loop variable...)
        return {result: val};
    };

    this.declare = function (iid, name, val, isArgument, isLocalSync, isCatchParam) {
        function write(sourceTmp) {
            if (!NODEJS_ENVIRONMENT && astQueries.isGlobalVariableDeclaration(J$.sid, iid)) {
                traceBuilder.makeFieldWriteStatement(tmpManager.getGlobalTmp(), name, sourceTmp, false, iid);
            } else {
                traceBuilder.makeMoveStatement(tmpManager.getVarTmp(name), sourceTmp, iid);
            }
        }

        // console.log("declare(%s, %s, %s, %s, %s)", iid, name, "%" + typeof val + "%", isArgument, argumentIndex);
        if (astQueries.isFunctionDeclaration(J$.sid, iid)) {
            write(tmpManager.popValueTmp(val));
        } else if (isArgument) {
            write(tmpManager.popValueTmp(val));
        } else if (isCatchParam) {
            // catch block entry
            tmpManager.markCaughtException();
            write(nativeSynthesisManager.fromNative(val, iid));
        } else {
            if (val === undefined) {
                // the *default* initialization of local variables
                // TODO add 'default-initialized' INFO here?
                var undefinedTmp = tmpManager.getIntermediaryTmp("defaultUndefined");
                traceBuilder.makePrimitiveStatement(undefined, undefinedTmp, iid);
                write(undefinedTmp);
            } else {
                // named function expression: `(function f(){J$.N(.., f, ...)})`
                write(nativeSynthesisManager.fromNative(val, iid));
            }
        }
        return {result: val};
    };

    this.write = function (iid, name, val, lhs, isGlobal, isScriptLocal, isDeclaration) {
        var sourceTmp;
        if (astQueries.isForInVariableUpdate(J$.sid, iid)) {
            sourceTmp = tmpManager.getIntermediaryTmp("forInString");
            traceBuilder.makePrimitiveStatement(val, sourceTmp, iid);
        } else {
            sourceTmp = tmpManager.popValueTmp(val);
        }
        if (isGlobalVariable(name, isGlobal, isScriptLocal)) {
            // o = 42;
            traceBuilder.makeFieldWriteStatement(tmpManager.getGlobalTmp(), name, sourceTmp, false, iid);
        } else {
            // var o;
            // o = 42;
            traceBuilder.makeMoveStatement(tmpManager.getVarTmp(name), sourceTmp, iid);
        }
        // the expression of an assignment is the assigned value!
        var resultTmp = tmpManager.getResultTmp();
        traceBuilder.makeMoveStatement(resultTmp, sourceTmp, iid);
        tmpManager.pushValueTmp(resultTmp, val, true);
        return {result: val};
    };

    this.putFieldPre = function (iid, base, offset, val, isComputed, isOpAssign) {
        return {base: base, offset: offset, val: val, skip: false};
    };

    this.putField = function (iid, base, offset, val, isComputed, isOpAssign) {
        // console.log("putField(%s, %s, %s, %s)", iid, base, offset, val);
        var sourceTmp;
        if (astQueries.isForInVariableUpdate(J$.sid, iid)) {
            sourceTmp = tmpManager.getIntermediaryTmp("forInString");
            traceBuilder.makePrimitiveStatement(val, sourceTmp, iid);
        } else {
            sourceTmp = tmpManager.popValueTmp(val);
        }

        if (isComputed && !isOpAssign /* the this.getField of the opAssignment have already popped the offset*/) {
            tmpManager.popValueTmp(offset);
        }
        var baseTmp = tmpManager.popValueTmp(base);

        if(isComputed) {
            traceBuilder.infoBuilder.makeNextFieldAccessIsDynamic(iid);
        }
        traceBuilder.makeFieldWriteStatement(baseTmp, offset, sourceTmp, isPrimitive(base)? false: isBeingInitialized.has(base), iid);

        if (offset === 'exports' && moduleManager.isModule(base)) {
            nativeSynthesisManager.toNative(val, sourceTmp, iid);
        }

        // the expression of an assignment is the assigned value!
        var resultTmp = tmpManager.getResultTmp();
        traceBuilder.makeMoveStatement(resultTmp, sourceTmp, iid);
        tmpManager.pushValueTmp(resultTmp, val, true);
        // console.log("DONE putField(%s, %s, %s, %s)", iid, base, offset, val);
        return {result: val};
    };

    this.read = function (iid, name, val, isGlobal, isScriptLocal) {
        // console.log("read(%s, %s, %s, %s, %s", iid, name, val, isGlobal, isPseudoGlobal);
        var resultTmp = tmpManager.getResultTmp();

        if (isGlobalVariable(name, isGlobal, isScriptLocal)) {
            // o;
            var modelingHack;
            if (isPrimitive(val)) {
                var modelingHackTmp = tmpManager.getIntermediaryTmp('fieldReadPrimitiveResultTmp');
                traceBuilder.makePrimitiveStatement(val, modelingHackTmp, iid);
                modelingHack = {fieldReadPrimitiveResultTmp: modelingHackTmp};
            }
            traceBuilder.makeFieldReadStatement(tmpManager.getGlobalTmp(), name, resultTmp, modelingHack, iid);
            if (!isPrimitive(val)) {
                nativeSynthesisManager.initializeFields(val, resultTmp, undefined, iid);
            }
        } else {
            // var o;
            // o;
            traceBuilder.makeMoveStatement(resultTmp, tmpManager.getVarTmp(name), iid);
        }
        tmpManager.pushValueTmp(resultTmp, val, true);
        return {result: val};
    };

    this.getFieldPre = function (iid, base, offset, isComputed, isOpAssign) {
        return {base: base, offset: offset, skip: false};
    };

    this.getField = function (iid, base, offset, val, isComputed, isOpAssign, isMethodCall) {
        var resultTmp = isMethodCall ? tmpManager.getIntermediaryTmp("methodCallBase") : tmpManager.getResultTmp();

        if (isComputed) {
            tmpManager.popValueTmp(offset);
        }

        var baseTmp = tmpManager.popValueTmp(base);
        if (isMethodCall) {
            tmpManager.pushValueTmp(baseTmp, base);
        }
        var objectBaseTmp = coercionUtil.toObject(base, baseTmp, iid);

        var primitiveResultTmp;
        if (isPrimitive(val)) {
            primitiveResultTmp = tmpManager.getIntermediaryTmp("primitiveResult");
            traceBuilder.makePrimitiveStatement(val, primitiveResultTmp, iid)
        }
        if(isComputed) {
            traceBuilder.infoBuilder.makeNextFieldAccessIsDynamic(iid);
        }
        traceBuilder.makeFieldReadStatement(objectBaseTmp, offset, resultTmp, primitiveResultTmp ? {fieldReadPrimitiveResultTmp: primitiveResultTmp} : undefined, iid);
        if (!isPrimitive(val)) {
            nativeSynthesisManager.initializeFields(val, resultTmp, undefined, iid);
        }
        if (isOpAssign) {
            // keep the base value around!
            tmpManager.pushValueTmp(objectBaseTmp, ((objectBaseTmp !== baseTmp) ? '*object(' + base + ')*' : base));
        }
        tmpManager.pushValueTmp(resultTmp, val, !isMethodCall);

        // console.log("DONE getField(%s, %s, %s, %s, %s, %s, %s, %s)", iid, base, offset, val, isComputed, isOpAssign, isMethodCall);
        return {result: val};
    };

    this.functionEnter = function (iid, f, dis, args) {
        var externalCaller = contextUtil.isCalledFromExternal();
        var asConstructor = !externalCaller && contextUtil.isCalledAsConstructor();
        if(asConstructor){
            isBeingInitialized.add(dis);
        }
        // console.log("functionEnter(%s, %s, %s, |args| = %s)", iid, typeof f, typeof dis, args.length);
        var tmps = tmpManager.popFunctionCallTemporaries(f, /* during a constructor call, the tmps.baseTmp is the prototypeTmp*/asConstructor ? dis.__proto__ : dis, args, externalCaller);
        if (externalCaller) {
            traceBuilder.infoBuilder.makeFunctionInvocation(tmps.functionTmp, tmps.baseTmp, tmps.argsTmps, false, iid);
        }

        tmpManager.markFunctionEntry();
        var argsTmps = tmps.argsTmps.map(function (e, i) {
            return tmpManager.getIntermediaryTmp("arg" + i);
        });
        var baseTmp = tmpManager.getIntermediaryTmp("base");
        var functionTmp = tmpManager.getIntermediaryTmp("function");

        // the parameters encode context information of the caller context, map them to get the callee context!
        traceBuilder.infoBuilder.makeFunctionEnter(functionTmp, baseTmp, argsTmps, tmpManager.getScopeID(), iid);
        argsTmps.forEach(function (e, i) {
            traceBuilder.makeMoveStatement(argsTmps[i], tmps.argsTmps[i], iid);
        });
        if (asConstructor) {
            // during a constructor call, the tmps.baseTmp is the prototypeTmp
            var prototypeTmp = tmps.baseTmp;
            var allocationTmp = nativeSynthesisManager.allocate(dis, [], prototypeTmp, iid);
            traceBuilder.makeMoveStatement(baseTmp, allocationTmp, iid);
        } else {
            traceBuilder.makeMoveStatement(baseTmp, tmps.baseTmp, iid);
        }
        traceBuilder.makeMoveStatement(functionTmp, tmps.functionTmp, iid);


        // a 4-step process, step 2 could be done in this.declare, but it seems cleaner to do it here

        // 1) initialize 'this'
        traceBuilder.makeMoveStatement(tmpManager.getThisTmp(), baseTmp, iid);

        // 2) initialize 'arguments'
        var argumentKeys = [];
        for (var i = 0; i < args.length; i++) {
            argumentKeys[i] = i + '';
        }
        var argumentsTmp = tmpManager.getIntermediaryTmp("arguments");
        traceBuilder.makeMoveStatement(argumentsTmp, nativeSynthesisManager.allocate(args, argumentKeys, undefined, iid), iid);

        for (var i = 0; i < args.length; i++) {
            traceBuilder.makeFieldWriteStatement(argumentsTmp, i, argsTmps[i], true, iid);
        }
        // 3) make undefined the default return value
        var returnTmp = tmpManager.getIntermediaryTmp("defaultReturn");
        var defaultReturnValue = undefined;
        tmpManager.pushValueTmp(returnTmp, defaultReturnValue)
        traceBuilder.makePrimitiveStatement(defaultReturnValue, returnTmp, iid);

        // 4) prepare arguments for the upcoming Jalangi-declares: push them on the stack, put 'arguments' last
        var currentParameterCount = astQueries.getFunctionEntryParameterCount(J$.sid, iid);
        for (var i = currentParameterCount - 1; i >= 0; i-- /* reverse order due to stack semantics */) {
            var argTmp;
            var arg;
            if (i >= argsTmps.length) {
                argTmp = tmpManager.getIntermediaryTmp("arg" + i);
                arg = undefined;
                traceBuilder.makePrimitiveStatement(arg, argTmp, iid);
            } else {
                argTmp = argsTmps[i];
                arg = args[i];
            }
            tmpManager.pushValueTmp(argTmp, arg);
        }
        tmpManager.pushValueTmp(argumentsTmp, "*arguments*");
    };

    this.functionExit = function (iid, returnVal, exceptionVal) {
        // console.log("functionExit(%s, %s, %s)", iid, returnVal, exceptionVal);
        if (exceptionVal === undefined) {
            // the returned temporary encodes context information, map it to the local context!
            var returnValueTmp = tmpManager.getIntermediaryTmp("return");
            traceBuilder.makeMoveStatement(returnValueTmp, tmpManager.popValueTmp(returnVal), iid);
            var thisTmp = tmpManager.getThisTmp();
            tmpManager.markFunctionReturn();
            if (contextUtil.isCalledFromExternal()) {
                // assumes constructor calls does *NOT* happen from native code!
                nativeSynthesisManager.toNative(returnVal, returnValueTmp, iid);
                traceBuilder.infoBuilder.makeFunctionReturn(returnValueTmp, iid);
                var fixedReturnValueTmp = tmpManager.getIntermediaryTmp("fixed-return");
                traceBuilder.infoBuilder.makeFunctionResult(fixedReturnValueTmp, iid);
                traceBuilder.makeMoveStatement(fixedReturnValueTmp, returnValueTmp, iid);
            } else {
                // the top of the stack is the return value
                if (contextUtil.isCalledAsConstructor() && isPrimitive(returnVal)) {
                    tmpManager.pushValueTmp(thisTmp, "*constructor this return*");
                } else {
                    tmpManager.pushValueTmp(returnValueTmp, returnVal);
                }
            }
        } else {
            var unboxedExceptionVal = exceptionVal.exception;
            nativeSynthesisManager.toNative(unboxedExceptionVal, tmpManager.getIntermediaryTmp("unknown-exception-source"), iid);
            tmpManager.markFunctionThrow();

        }
        traceCollectionController.maybeStop(exceptionVal);
        return {returnVal: returnVal, exceptionVal: exceptionVal, isBacktrack: false};
    };

    this.scriptEnter = function (iid, val, origFileName, dis, module, require) {
        astQueries.registerASTInfo(J$.sid, J$.ast_info /* copy before it is overridden! */);
        traceBuilder.makeMoveStatement(tmpManager.getGlobalTmp(), nativeSynthesisManager.allocate(global, ['Intl' /* TODO Ignore for now: full of special getters! */], undefined, iid), iid);
        traceBuilder.makeMoveStatement(tmpManager.getThisTmp(), nativeSynthesisManager.allocate(dis, [], undefined, iid), iid);
        if (NODEJS_ENVIRONMENT) {
            traceBuilder.makeMoveStatement(tmpManager.getVarTmp('global'), tmpManager.getGlobalTmp(), iid);
            var moduleTmp = tmpManager.getVarTmp('module');
            if (isPrimitive(module)) {
                traceBuilder.makePrimitiveStatement(module, moduleTmp, iid);
            } else {
                traceBuilder.makeMoveStatement(moduleTmp, nativeSynthesisManager.allocate(module, undefined, undefined, iid), iid);
            }
            var requireTmp = tmpManager.getVarTmp('require');
            if (isPrimitive(require)) {
                traceBuilder.makePrimitiveStatement(require, requireTmp, iid);
            } else {
                traceBuilder.makeMoveStatement(requireTmp, nativeSynthesisManager.allocate(require, ['paths', 'cache'], undefined, iid), iid);
            }
            var filenameTmp = tmpManager.getIntermediaryTmp('__filename');
            var dirnameTmp = tmpManager.getIntermediaryTmp('__dirname');
            traceBuilder.makePrimitiveStatement("*__filename*" /* some string */, filenameTmp, iid);
            traceBuilder.makePrimitiveStatement("*__dirname*" /* some string */, dirnameTmp, iid);
            traceBuilder.makeMoveStatement(tmpManager.getVarTmp('__filename'), filenameTmp, iid);
            traceBuilder.makeMoveStatement(tmpManager.getVarTmp('__dirname'), dirnameTmp, iid);
            var exportsTmp = tmpManager.getIntermediaryTmp('__exports');
            traceBuilder.makeFieldReadStatement(moduleTmp, 'exports', exportsTmp, iid);
            traceBuilder.makeMoveStatement(tmpManager.getVarTmp('exports'), exportsTmp, iid);
        }
        moduleManager = new ModuleManager(module);
    };

    this.scriptExit = function (iid, exceptionVal) {
        traceCollectionController.maybeStop(exceptionVal);
        return {exceptionVal: undefined /* squelch exception! */, isBacktrack: false};
    };

    this.binaryPre = function (iid, op, left, right, isOpAssign, isSwitchCaseComparison) {
        return {op: op, left: left, right: right, skip: false};
    };

    this.binary = function (iid, op, left, right, result, isOpAssign, isSwitchCaseComparison) {
        //console.log("binary(%s, %s, %s, %s, %s, %s, %s, %s)", iid, op, left, right, result, isOpAssign, isSwitchCaseComparison);
        if (op === 'delete') {
            // trace delete, resolve the property name fully
            var leftTmp = tmpManager.popValueTmp(left);
            var objectTmp = coercionUtil.toObject(left, leftTmp, iid);
            traceBuilder.makeDeleteStatement(objectTmp, right, iid);
        } else {
            if (isSwitchCaseComparison) {
                // this is a synthetic comparison done by Jalangi
                // the switch target has been popped long ago, but we do not care about it anymore as switch cases is a non-coercing equality check

                // pop the current switch key
                tmpManager.popValueTmp(right);
            } else {
                var rightTmp = tmpManager.popValueTmp(right);
                var leftTmp = tmpManager.popValueTmp(left);
                coercionUtil.binary(op, left, leftTmp, right, rightTmp, iid);
            }
        }
        var resultTmp = (isOpAssign) ? tmpManager.getIntermediaryTmp("opAssign") : tmpManager.getResultTmp();
        // the result is always a primitive(?)
        if (DEBUG) {
            assert(isPrimitive(result));
        }
        traceBuilder.makePrimitiveStatement(result, resultTmp, iid);
        tmpManager.pushValueTmp(resultTmp, result, !isOpAssign);
        return {result: result};
    };

    this.unaryPre = function (iid, op, left) {
        return {op: op, left: left, skip: false};
    };

    this.unary = function (iid, op, left, result) {
        // console.log("unary(%s, %s, %s ((%s)), %s)", iid, op, left, typeof left, result);
        var sourceTmp = tmpManager.popValueTmp(left);
        /* throw coercedTmp away */
        coercionUtil.unary(op, left, sourceTmp, iid);
        var resultTmp = tmpManager.getResultTmp();
        traceBuilder.makePrimitiveStatement(result, resultTmp, iid);
        tmpManager.pushValueTmp(resultTmp, result, true);
        return {result: result};
    };

    this.conditional = function (iid, result) {
        //console.log("conditional(%s, %s)", iid, result);
        var sourceTmp = tmpManager.popValueTmp(result);
        var booleanResultTmp = coercionUtil.toBoolean(result, sourceTmp, iid);
        var resultTmp = tmpManager.getResultTmp();

        // actual popping is done at this.endExpression
        tmpManager.pushValueTmp(sourceTmp/* the uncoerced value! */, result);

        if (astQueries.isLazyBooleanResult(J$.sid, iid, !result)) {
            // for non-lazy && and || , the result should be popped immediately
            tmpManager.popValueTmp(result);
        } else {
            traceBuilder.makeMoveStatement(resultTmp, booleanResultTmp, iid);
        }

        return {result: result};
    };

    this._return = function (iid, val) {
        // TODO move some this.functionExit logic here
        tmpManager.pushDummyEndExpressionTmp();
        return {result: val};
    };

    this._throw = function (iid, val) {
        nativeSynthesisManager.toNative(val, tmpManager.popValueTmp(val), iid);
        return {result: val};
    };
    this.endExpression = function () {
        tmpManager.popEndExpressionValueTmp();
    }

    this.endExecution = function () {
    }

    this._with = function(iid, val){
        console.warn("%s: Ignoring with-statement!!!", J$.iidToLocation(J$.getGlobalIID(iid)));
        tmpManager.popEndExpressionValueTmp();
    }
}

exports.TraceBuildingAnalysis = TraceBuildingAnalysis;
