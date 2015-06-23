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
var jalangiInterface = require("../src/JalangiInterface");
var astUtil = jalangiInterface.astUtil;
function isJalangiCall(potentialJalangiCall, callType) {
    return isDirectJalangiCall(potentialJalangiCall, callType) || isIndirectJalangiCall(potentialJalangiCall, callType);
}

function isIgnoreWrappedJalangiCall(potentialJalangiCall) {
    if (isDirectJalangiCall(potentialJalangiCall, 'I')) {
        return isJalangiCall(potentialJalangiCall.arguments[0].consequent.right);
    } else if (isIndirectJalangiCall(potentialJalangiCall, 'I')) {
        return isIgnoreWrappedJalangiCall(potentialJalangiCall.callee)
    }
}

function unwrapJalangiIgnoreAndAssignCall(node) {
    if(node.type === "AssignmentExpression"){
        node = node.right;
    }
    if (isDirectJalangiCall(node, 'I')) {
        var right = node.arguments[0].consequent.right;
        return right !== undefined && unwrapJalangiIgnoreAndAssignCall(right);
    }
    if (isIndirectJalangiCall(node, 'I')) {
        return unwrapJalangiIgnoreAndAssignCall(node.callee);
    }
    return node;
}

function isDirectJalangiCall(potentialJalangiCall, callType) {
    var isJalangiCall = potentialJalangiCall !== undefined &&
        potentialJalangiCall.type === 'CallExpression' &&
        potentialJalangiCall.callee.type === 'MemberExpression' &&
        potentialJalangiCall.callee.object.type === 'Identifier' &&
        potentialJalangiCall.callee.object.name === astUtil.JALANGI_VAR &&
        potentialJalangiCall.callee.property.type === 'Identifier';
    if (isJalangiCall) {
        var actualCallType = potentialJalangiCall.callee.property.name;
        if (callType === undefined) {
            return actualCallType !== 'I';
        }
        return callType === actualCallType;
    }
    return false;
}

function isIndirectJalangiCall(potentialJalangiCall, callType) {
    return potentialJalangiCall !== undefined && potentialJalangiCall.type === 'CallExpression' &&
        isDirectJalangiCall(potentialJalangiCall.callee, callType);
}

function getActualJalangiCall(jalangiCall) {
    if (isDirectJalangiCall(jalangiCall)) {
        return jalangiCall;
    } else if (isIndirectJalangiCall(jalangiCall)) {
        return jalangiCall.callee;
    }
    throw new Error("Not a Jalangi call at all?!?! " + jalangiCall);
}

function getArgumentsToJalangiCall(jalangiCall) {
    return getActualJalangiCall(jalangiCall).arguments;
}

function getIIDOfJalangiCall(jalangiCall) {
    return getArgumentsToJalangiCall(jalangiCall)[0].value;
}
exports.isJalangiCall = isJalangiCall;
exports.unwrapJalangiIgnoreAndAssignCall = unwrapJalangiIgnoreAndAssignCall;
exports.getIIDOfJalangiCall = getIIDOfJalangiCall;
exports.getArgumentsToJalangiCall = getArgumentsToJalangiCall;
exports.isIndirectJalangiCall = isIndirectJalangiCall;
