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
 * Passive, composite analysis that calls two sub analyses in lockstep.
 */
function CompositeAnalysis(analysis1, analysis2) {
    this.setAnalyses = function (newAnalysis1, newAnalysis2) {
        analysis1 = newAnalysis1;
        analysis2 = newAnalysis2;
    }

    this.invokeFunPre = function (iid, f, base, args, isConstructor, isMethod) {
        if (analysis1.invokeFunPre) {
            analysis1.invokeFunPre(iid, f, base, args, isConstructor, isMethod);
        }
        if (analysis2.invokeFunPre) {
            analysis2.invokeFunPre(iid, f, base, args, isConstructor, isMethod);
        }
    };

    this.invokeFun = function (iid, f, base, args, result, isConstructor, isMethod) {
        if (analysis1.invokeFun) {
            analysis1.invokeFun(iid, f, base, args, result, isConstructor, isMethod);
        }
        if (analysis2.invokeFun) {
            analysis2.invokeFun(iid, f, base, args, result, isConstructor, isMethod);
        }
    };

    this.literal = function (iid, val, hasGetterSetter) {
        if (analysis1.literal) {
            analysis1.literal(iid, val, hasGetterSetter);
        }
        if (analysis2.literal) {
            analysis2.literal(iid, val, hasGetterSetter);
        }
    };

    this.forinObject = function (iid, val) {
        if (analysis1.forinObject) {
            analysis1.forinObject(iid, val);
        }
        if (analysis2.forinObject) {
            analysis2.forinObject(iid, val);
        }
    };

    this.declare = function (iid, name, val, isArgument, argumentIndex, isCatchParam) {
        if (analysis1.declare) {
            analysis1.declare(iid, name, val, isArgument, argumentIndex, isCatchParam);
        }
        if (analysis2.declare) {
            analysis2.declare(iid, name, val, isArgument, argumentIndex, isCatchParam);
        }
    };

    this.getFieldPre = function (iid, base, offset, isComputed, isOpAssign, isMethodCall) {
        if (analysis1.getFieldPre) {
            analysis1.getFieldPre(iid, base, offset, isComputed, isOpAssign, isMethodCall);
        }
        if (analysis2.getFieldPre) {
            analysis2.getFieldPre(iid, base, offset, isComputed, isOpAssign, isMethodCall);
        }
    };

    this.getField = function (iid, base, offset, val, isComputed, isOpAssign, isMethodCall) {
        if (analysis1.getField) {
            analysis1.getField(iid, base, offset, val, isComputed, isOpAssign, isMethodCall);
        }
        if (analysis2.getField) {
            analysis2.getField(iid, base, offset, val, isComputed, isOpAssign, isMethodCall);
        }
    };

    this.putFieldPre = function (iid, base, offset, val, isComputed, isOpAssign) {
        if (analysis1.putFieldPre) {
            analysis1.putFieldPre(iid, base, offset, val, isComputed, isOpAssign);
        }
        if (analysis2.putFieldPre) {
            analysis2.putFieldPre(iid, base, offset, val, isComputed, isOpAssign);
        }
    };

    this.putField = function (iid, base, offset, val, isComputed, isOpAssign) {
        if (analysis1.putField) {
            analysis1.putField(iid, base, offset, val, isComputed, isOpAssign);
        }
        if (analysis2.putField) {
            analysis2.putField(iid, base, offset, val, isComputed, isOpAssign);
        }
    };

    this.read = function (iid, name, val, isGlobal, isScriptLocal) {
        if (analysis1.read) {
            analysis1.read(iid, name, val, isGlobal, isScriptLocal);
        }
        if (analysis2.read) {
            analysis2.read(iid, name, val, isGlobal, isScriptLocal);
        }
    };

    this.write = function (iid, name, val, lhs, isGlobal, isScriptLocal, isDeclaration) {
        if (analysis1.write) {
            analysis1.write(iid, name, val, lhs, isGlobal, isScriptLocal, isDeclaration);
        }
        if (analysis2.write) {
            analysis2.write(iid, name, val, lhs, isGlobal, isScriptLocal, isDeclaration);
        }
    };

    this.functionEnter = function (iid, f, dis, args) {
        if (analysis1.functionEnter) {
            analysis1.functionEnter(iid, f, dis, args);
        }
        if (analysis2.functionEnter) {
            analysis2.functionEnter(iid, f, dis, args);
        }
    };

    this.functionExit = function (iid, returnVal, exceptionVal) {
        if (analysis1.functionExit) {
            analysis1.functionExit(iid, returnVal, exceptionVal);
        }
        if (analysis2.functionExit) {
            analysis2.functionExit(iid, returnVal, exceptionVal);
        }
    };

    this.scriptEnter = function (iid, val, origFileName, dis, module, require) {
        if (analysis1.scriptEnter) {
            analysis1.scriptEnter(iid, val, origFileName, dis, module, require);
        }
        if (analysis2.scriptEnter) {
            analysis2.scriptEnter(iid, val, origFileName, dis, module, require);
        }
    };

    this.scriptExit = function (iid, exceptionVal) {
        if (analysis1.scriptExit) {
            analysis1.scriptExit(iid, exceptionVal);
        }
        if (analysis2.scriptExit) {
            analysis2.scriptExit(iid, exceptionVal);
        }
    };

    this.binaryPre = function (iid, op, left, right, isOpAssign, isSwitchCaseComparison) {
        if (analysis1.binaryPre) {
            analysis1.binaryPre(iid, op, left, right, isOpAssign, isSwitchCaseComparison);
        }
        if (analysis2.binaryPre) {
            analysis2.binaryPre(iid, op, left, right, isOpAssign, isSwitchCaseComparison);
        }
    };

    this.binary = function (iid, op, left, right, result, isOpAssign, isSwitchCaseComparison) {
        if (analysis1.binary) {
            analysis1.binary(iid, op, left, right, result, isOpAssign, isSwitchCaseComparison);
        }
        if (analysis2.binary) {
            analysis2.binary(iid, op, left, right, result, isOpAssign, isSwitchCaseComparison);
        }
    };

    this.unaryPre = function (iid, op, left) {
        if (analysis1.unnaryPre) {
            analysis1.unaryPre(iid, op, left);
        }
        if (analysis2.unnaryPre) {
            analysis2.unaryPre(iid, op, left);
        }
    };

    this.unary = function (iid, op, left, result) {
        if (analysis1.unary) {
            analysis1.unary(iid, op, left, result);
        }
        if (analysis2.unary) {
            analysis2.unary(iid, op, left, result);
        }
    };

    this.conditional = function (iid, result) {
        if (analysis1.conditional) {
            analysis1.conditional(iid, result);
        }
        if (analysis2.conditional) {
            analysis2.conditional(iid, result);
        }
    };

    this._return = function (iid, val) {
        if(analysis1._return){
            analysis1._return(iid, val);
        }
        if(analysis2._return){
            analysis2._return(iid, val);
        }
    };

    this.endExecution = function () {
        if (analysis1.endExecution) {
            analysis1.endExecution();
        }
        if (analysis2.endExecution) {
            analysis2.endExecution();
        }
    };
    this.endExpression = function () {
        if (analysis1.endExpression) {
            analysis1.endExpression();
        }
        if (analysis2.endExpression) {
            analysis2.endExpression();
        }
    };


    this._with = function(iid, val){
        if (analysis1._with) {
            analysis1._with(iid, val);
        }
        if (analysis2._with) {
            analysis2._with(iid, val);
        }
    }
}
exports.CompositeAnalysis = CompositeAnalysis;
