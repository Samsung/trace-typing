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
/**
 * Fake/Mock implementations of tracing components.
 * Can be used to gauge potential performance gains by optimizing the real implementation.
 */
// Author: Esben Andreasen

function FakeContextAnalysis() {
    var real = new (require("./ContextAnalysis").ContextAnalysis);
    // not really fake, as the output is actually significant - some calls can be avoided though
    this.contextState = real.contextState;
    this.analysisPre = {
        invokeFunPre: function (iid, f, base, args, isConstructor, isMethod) {
            real.analysisPre.invokeFunPre(iid, f, base, args, isConstructor, isMethod);
        },
        functionEnter: function (iid, f, dis, args) {
            real.analysisPre.functionEnter(iid, f, dis, args);
        },
        literal: function (iid, val, hasGetterSetter) {
            real.analysisPre.literal(iid, val, hasGetterSetter);
        }
    };
    this.analysisPost = {
        functionExit: function (iid, returnVal, exceptionVal) {
            real.analysisPost.functionExit(iid, returnVal, exceptionVal);
        }
    };
}

function FakeTraceBuilder() {
    var noop = function () {
    };
    return {
        infoBuilder: {
            makeFunctionInvocation: noop,
            makeFunctionEnter: noop,
            makeFunctionReturn: noop,
            makeFunctionResult: noop,
            makeCoercion: noop
        },
        makeMoveStatement: noop,
        makeFieldWriteStatement: noop,
        makeDeleteStatement: noop,
        makeInfoStatement: noop,
        makeFieldReadStatement: noop,
        makeNewStatement: noop,
        makePrimitiveStatement: noop,
        getTrace: function () {
            return [];
        },
        checkTraceConsistency: noop,
        externals: {}
    }
}
function FakeTemporaryManager() {

    function noop() {
    }

    function makeTmp() {
        return 0;
    }

    this.popFunctionCallTemporaries = function () {
        return {argsTmps: []}
    };
    this.pushFunctionCallTemporaries = noop;
    this.getVarTmp = makeTmp;
    this.popValueTmp = makeTmp;
    this.popValueTmps = function () {
        return [];
    };
    this.pushValueTmps = noop;
    this.makeUnknownTemporaryDescriptions = noop
    this.getCatchTmp = makeTmp;
    this.getThisTmp = makeTmp;
    this.pushValueTmp = noop;
    this.getFreshTmp = makeTmp;
    this.getGlobalTmp = makeTmp;
    this.checkEmptyShadowStack = noop;
    this.isShadowStackEmpty = noop;
    this.logStack = noop;
    this.markFunctionEntry = noop;
    this.markFunctionReturn = noop;
}
function FakeCoercionUtil() {
    return {
        binary: function (op, leftValue, leftTmp, rightValue, rightTmp) {
            return [leftTmp, rightTmp];
        },
        unary: function (op, value, valueTmp) {
            return valueTmp;
        },
        toBoolean: function (value, valueTmp) {
            return valueTmp;
        },
        toObject: function (value, valueTmp) {
            return valueTmp;
        }
    };
}
exports.FakeCoercionUtil = FakeCoercionUtil;
exports.FakeTemporaryManager = FakeTemporaryManager;
exports.FakeTraceBuilder = FakeTraceBuilder;
exports.FakeContextAnalysis = FakeContextAnalysis;
