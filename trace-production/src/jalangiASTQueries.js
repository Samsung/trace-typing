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
    return isDirectJalangiCall(potentialJalangiCall, callType) || isIndirectJalangiCall(potentialJalangiCall, callType) || isPrefixOperatorJalangiCall(potentialJalangiCall, callType);
}

function isPrefixOperatorJalangiCall(potentialJalangiCall, callType) {
    var isAssignment = potentialJalangiCall !== undefined && potentialJalangiCall.type === 'AssignmentExpression';
    if (!isAssignment)
        return false;
    var isAssignmentCall = isJalangiCall(potentialJalangiCall.right, 'W');
    if (!isAssignmentCall)
        return false;
    var potentialPreOrPostfix = potentialJalangiCall.right.arguments[2];
    return isJalangiPreOrPostfixOperation(potentialPreOrPostfix);
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
    }else if(isPrefixOperatorJalangiCall(jalangiCall)){
        return jalangiCall.right;
    }
    throw new Error("Not a Jalangi call at all?!?! " + jalangiCall);
}

function getArgumentsToJalangiCall(jalangiCall) {
    return getActualJalangiCall(jalangiCall).arguments;
}

function getIIDOfJalangiCall(jalangiCall) {
    return getArgumentsToJalangiCall(jalangiCall)[0].value;
}

function isJalangiPreOrPostfixOperation(potentialJalangiCall) {
    // simple version: variable update
    var isJalangiBinary = isJalangiCall(potentialJalangiCall, 'B')
    if (isJalangiBinary) {
        var argumentsToBinaryCall = getArgumentsToJalangiCall(potentialJalangiCall);
        var potentialConstant = unwrapJalangiIgnoreAndAssignCall(argumentsToBinaryCall[3]);
        var isConstantRightArgument = potentialConstant.type === "Literal" && potentialConstant.value === 1;
        if (isConstantRightArgument) {
            return true;
        }
    }
    // complex version: property update
    var isJalangiHiddenBinary = isJalangiCall(potentialJalangiCall.callee, "A")
    if (isJalangiHiddenBinary) {
        var potentialConstant = unwrapJalangiIgnoreAndAssignCall(potentialJalangiCall.arguments[0]);
        var isConstantRightArgument = potentialConstant.type === "Literal" && potentialConstant.value === 1;
        if (isConstantRightArgument) {
            return true;
        }
    }
    return false;
}
exports.isJalangiCall = isJalangiCall;
exports.unwrapJalangiIgnoreAndAssignCall = unwrapJalangiIgnoreAndAssignCall;
exports.getIIDOfJalangiCall = getIIDOfJalangiCall;
exports.getArgumentsToJalangiCall = getArgumentsToJalangiCall;
exports.isIndirectJalangiCall = isIndirectJalangiCall;
exports.isJalangiPreOrPostfixOperation = isJalangiPreOrPostfixOperation;
