/*
 * Copyright 2014 Samsung Information Systems America, Inc.
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

var assert = require("assert"),
    astUtilForTracing = require("../src/astUtilForTracing.js"),
    computeLazyBooleanLocations = astUtilForTracing.computeLazyBooleanLocations,
    instrumentCode = require("../src/JalangiInterface").instrumentCode,
    temp = require('temp');

function checkCode(code, expected, analysis) {
    var instResult = instrumentCode(code, {
        wrapProgram: false,
        metadata: true,
        dirIIDFile: temp.dir,
        initIID: true
    });
    //console.log(instResult.code);
    //console.log(JSON.stringify(instResult.instAST));
    var actual = analysis(instResult.instAST);
    assert.deepEqual(actual, expected);
}

function checkLazyBoolean(code, expected) {
    checkCode(code, expected, computeLazyBooleanLocations);
}
function checkDynamicPropertyDeleteNames(code, expected) {
    checkCode(code, expected, astUtilForTracing.computeDynamicPropertyDeleteNames);
}
function checkFunctionEntryParameterCounts(code, expected) {
    checkCode(code, expected, astUtilForTracing.computeParameterCounts);
}
function checkVoidedExpressions(code, expected) {
    checkCode(code, expected, astUtilForTracing.computeVoidedExpressions);
}
function checkForInVariableUpdates(code, expected) {
    checkCode(code, expected, astUtilForTracing.computeForInVariableUpdates);
}
function checkFunctionDeclarations(code, expected) {
    checkCode(code, expected, astUtilForTracing.computeFunctionDeclarations);
}

describe('astUtilForTracing', function () {
    describe("computeLazyBooleanLocations", function () {
        it('should handle no lazy', function () {
            checkLazyBoolean("3+4+5", []);
        });
        it('should handle lazy and', function () {
            checkLazyBoolean("1 && 2", [[8, false]]);
        });
        it('should handle lazy and with ref', function () {
            checkLazyBoolean("i && 2", [[8, false]]);
        });
        it('should handle lazy and with call', function () {
            checkLazyBoolean("var f; f() && 2", [[8, false]]);
        });
        it('should handle lazy and with ref call', function () {
            checkLazyBoolean("f() && 2", [[8, false]]);
        });
        it('should handle lazy or', function () {
            checkLazyBoolean("1 || 2", [[8, true]]);
        });
        it('should ignore fake lazy and', function () {
            checkLazyBoolean("1? 2: 1", []);
        });
        it('should ignore fake lazy or', function () {
            checkLazyBoolean("1? 1: 2", []);
        });
        it('should handle multiple lazies', function () {
            checkLazyBoolean("1 && 2; 3 && 4;", [[8, false], [16, false]]);
        });
        it('should handle long lazies', function () {
            checkLazyBoolean("1 && 2 && 3;", [[16, false], [8, false]]);
        });
        it('should handle mixed lazies', function () {
            checkLazyBoolean("1 && 2 || 3;", [[16, true], [8, false]]);
        });
        it('should handle nested lazies', function () {
            checkLazyBoolean("1 && (2 || 3);", [[16, false], [8, true]]);
        });
    });

    describe("computeDynamicPropertyDeleteNames", function () {
        it('should handle no property access', function () {
            checkDynamicPropertyDeleteNames("1 + 2", []);
        });
        it('should handle static property accesses', function () {
            checkDynamicPropertyDeleteNames("var o; o.p, v = o.p; delete o.p", []);
        });
        it('should handle dynamic property read', function () {
            checkDynamicPropertyDeleteNames("var o, p; o[p]", []);
        });
        it('should handle dynamic property delete', function () {
            checkDynamicPropertyDeleteNames("var o, p; delete o[p]", [17]);
        });
        it('should handle prefix-property dynamic property', function () {
            checkDynamicPropertyDeleteNames("var o, p; o[++p.p]()", []);
        });

    });
    describe("computeParameterCounts", function () {
        it('should handle no functions', function () {
            checkFunctionEntryParameterCounts("1 + 2", []);
        });
        it('should handle zero parameters', function () {
            checkFunctionEntryParameterCounts("function f(){}", [[9, 0]]);
        });
        it('should handle one parameters', function () {
            checkFunctionEntryParameterCounts("function f(p1){}", [[9, 1]]);
        });
        it('should handle two parameters', function () {
            checkFunctionEntryParameterCounts("function f(p1, p2){}", [[9, 2]]);
        });
        it('should handle multiple functions', function () {
            checkFunctionEntryParameterCounts("function f(){} function g(p1){}", [[9, 0], [25, 1]]);
        });
        it('should handle nested functions', function () {
            checkFunctionEntryParameterCounts("function f(){function g(p1){}}", [[33, 0], [9, 1]]);
        });
        it('should handle function expressions', function () {
            checkFunctionEntryParameterCounts("var f = function (p1){}", [[9, 1]]);
        });
    });
    describe("computeVoidedExpressions", function () {
        it('should handle no voids', function () {
            checkVoidedExpressions("1 + 2", []);
        });
        it('should handle one void', function () {
            checkVoidedExpressions("void 3", [9]);
        });
        it('should handle void with ref', function () {
            checkVoidedExpressions("void x", [9]);
        });
        it('should handle void with call', function () {
            checkVoidedExpressions("var f; void f()", [17]);
        });
        it('should handle void with ref call', function () {
            checkVoidedExpressions("var f; void f()", [17]);
        });
        it('should handle two voids', function () {
            checkVoidedExpressions("void 4; void 5;", [9, 25]);
        });
        it('should handle nested voids', function () {
            checkVoidedExpressions("void void 6", [9]);
        });
        it('should handle void with call to defined function', function () {
            checkVoidedExpressions("void f(); function f(){};", [17]);
        });
    });
    describe("computeForInVariableUpdates", function () {
        it('should handle no for-in', function () {
            checkForInVariableUpdates("1 + 2", []);
        });
        it('should handle single inline-declared variable for-in', function () {
            checkForInVariableUpdates("for(var p in {}){}", [25]);
        });
        it('should handle single declared variable for-in', function () {
            checkForInVariableUpdates("var p; for(p in {}){}", [25]);
        });
        it('should handle single for-in', function () {
            checkForInVariableUpdates("for(p in {}){}", [25]);
        });
        it('should handle multiple for-ins', function () {
            checkForInVariableUpdates("for(p1 in {}){} for(p2 in {}){}", [25, 57]);
        });
        it('should handle for-in with property as variable', function () {
            checkForInVariableUpdates("var o; for(o.p in {}){}", [33]);
        });
        it('should handle for-in with property of unknown as variable', function () {
            checkForInVariableUpdates("for(o.p in {}){}", [33]);
        });
        it('should handle for-in with property of call as variable', function () {
            checkForInVariableUpdates("var f; for(f().p in {}){}", [41]);
        });
        it('should handle lodash-bug', function () {
            checkForInVariableUpdates(
                ';(function() {' +
                '    var shimKeys = function(object) {' +
                '      var index, iterable = object, result = [];' +
                '      if (!iterable) return result;' +
                '      if (!(objectTypes[typeof object])) return result;' +
                '        for (index in iterable) {' +
                '          if (hasOwnProperty.call(iterable, index)) {' +
                '            result.push(index);' +
                '          }' +
                '        }' +
                '      return result' +
                '    };' +
                '}.call(this));',
                [217]);
        });
    });
    describe("computeFunctionDeclarations", function () {
        it('should handle no declarations', function () {
            checkFunctionDeclarations("1 + 2", []);
        });
        it('should handle one declaration', function () {
            checkFunctionDeclarations("function f(){}", [41]);
        });
        it('should handle two declarations', function () {
            checkFunctionDeclarations("function f(){} function g(){}", [57, 73]);
        });
        it('should handle nested declarations', function () {
            checkFunctionDeclarations("function f(){function g(){}}", [49, 73]);
        });
        it('should not capture other declarations', function () {
            checkFunctionDeclarations("var x = 42; (function(){x = '42';})", []);
        });
        it('should not capture function expressions', function () {
            checkFunctionDeclarations("(function(){})", []);
        });
    });
});