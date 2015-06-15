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
UNITTESTING = true;
var assert = require("assert");
var CoercionUtil = require("../src/CoercionUtil.js").CoercionUtil;


function TestTraceBuilder() {
    this.infoBuilder = {
        makeCoercion: function (sourceTmp, type, sinkTmp) {
            testState.coercions.push([sourceTmp, type, sinkTmp]);
        }
    };
    this.makePrimitiveStatement = function () {
    }
}
function check(expected) {
    assert.deepEqual(testState.coercions, expected);
}

var testState = (function () {
    var nextTmp = 0;
    return {
        reset: function () {
            this.coercions = [];
            nextTmp = 0;
        },
        coercions: [],
        tmpGenerator: function () {
            return "<" + nextTmp++ + ">";
        }
    };
})();

var coerceTypes = { // copied from traceElements.js
    Object: 'Object',
    Boolean: 'Boolean',
    Number: 'Number',
    String: 'String',
    // these last two types can occur when toString or valueOf are used
    Null: 'Null',
    Undefined: 'Undefined'
};
var testTraceBuilder = new TestTraceBuilder();
var coercionUtil = new CoercionUtil(testState.tmpGenerator, testTraceBuilder, coerceTypes, {
    allocate: function (v) {
        return v;
    }
});
try {
    describe('CoercionUtil', function () {
        beforeEach(function () {
            testState.reset();
        });
        var cObject = coerceTypes.Object;
        var cBoolean = coerceTypes.Boolean;
        var cNumber = coerceTypes.Number;
        var cString = coerceTypes.String;
        var cNull = coerceTypes.Null;
        var cUndefined = coerceTypes.Undefined;
        var tS0 = '<S0>';
        var tS1 = '<S1>';
        var tS2 = '<S2>';
        var t0 = '<0>';
        var t1 = '<1>';
        var t2 = '<2>';
        var t3 = '<3>';
        var t4 = '<4>';
        var t5 = '<5>';
        describe('explicit coercions', function () {
            it('should handle bool no-op', function () {
                coercionUtil.toBoolean(true, tS0);
                check([]);
            });
            it('should handle string -> bool', function () {
                coercionUtil.toBoolean('foo', tS0);
                check([[tS0, cBoolean, t0]]);
            });
            it('should handle obj -> bool', function () {
                coercionUtil.toBoolean({}, tS0);
                check([[tS0, cBoolean, t0]]);
            });
            it('should handle object no-op', function () {
                coercionUtil.toObject({}, tS0);
                check([]);
            });
        });
        describe('unary coercions', function () {
            it('should handle bool no-op', function () {
                coercionUtil.unary('!', true, tS0);
                check([]);
            });
            it('should handle string -> bool', function () {
                coercionUtil.unary('!', 'foo', tS0);
                check([[tS0, cBoolean, t0]]);
            });
            it('should handle number no-op', function () {
                coercionUtil.unary('~', 42, tS0);
                check([]);
            });
            it('should handle string -> number', function () {
                coercionUtil.unary('~', 'foo', tS0);
                check([[tS0, cNumber, t0]]);
            });
        });
        describe('binary coercions', function () {
            describe('additive coercions', function () {
                it('should handle string + string', function () {
                    coercionUtil.binary('+', 'foo', tS0, 'bar', tS1);
                    check([]);
                });
                it('should handle number + number', function () {
                    coercionUtil.binary('+', 42, tS0, 33, tS1);
                    check([]);
                });
                it('should handle number + string', function () {
                    coercionUtil.binary('+', 42, tS0, 'bar', tS1);
                    check([[tS0, cString, t0]]);
                });
                it('should handle string + number', function () {
                    coercionUtil.binary('+', 'foo', tS0, 33, tS1);
                    check([[tS1, cString, t0]]);
                });
                it('should handle boolean + number', function () {
                    coercionUtil.binary('+', true, tS0, 33, tS1);
                    check([[tS0, cNumber, t0]]);
                });
                it('should handle string + object', function () {
                    coercionUtil.binary('+', 'foo', tS0, {}, tS1);
                    check([[tS1, cString, t0]]);
                });
                it('should handle number + object', function () {
                    coercionUtil.binary('+', 42, tS0, {}, tS1); // both coerced to strings!
                    check([[tS1, cString, t0], [tS0, cString, t1]]);
                });
            });
            describe('relative coercions', function () {
                it('should handle number + number', function () {
                    coercionUtil.binary('<', 42, tS0, 33, tS1);
                    check([]);
                });
                it('should handle string < string', function () {
                    coercionUtil.binary('<', 'foo', tS0, 'bar', tS1);
                    check([]);
                });
                it('should handle string < number', function () {
                    coercionUtil.binary('<', 'foo', tS0, 42, tS1);
                    check([[tS0, cNumber, t0]]);
                });
                it('should handle bool < object', function () {
                    coercionUtil.binary('<', true, tS0, {}, tS1);
                    check([[tS1, cString, t0], ["<S0>", "Number", "<1>"], ["<0>", "Number", "<2>"]]);
                });
            });
            describe('equality coercions', function () {
                it('should handle number == number', function () {
                    coercionUtil.binary('==', 42, tS0, 33, tS1);
                    check([]);
                });
                it('should handle string == string', function () {
                    coercionUtil.binary('==', 'foo', tS0, 'bar', tS1);
                    check([]);
                });
                it('should handle null == undefined', function () {
                    coercionUtil.binary('==', null, tS0, undefined, tS1);
                    check([]);
                });
                // expect failures from here
                it('should handle number == string', function () {
                    coercionUtil.binary('==', 42, tS0, 'bar', tS1);
                    check([[tS1, cNumber, t0]]);
                });
                it('should handle string == number', function () {
                    coercionUtil.binary('==', 'foo', tS0, 42, tS1);
                    check([[tS0, cNumber, t0]]);
                });
                it('should handle number == boolean', function () {
                    coercionUtil.binary('==', 42, tS0, true, tS1);
                    check([[tS1, cNumber, t0]]);
                });
                it('should handle boolean == number', function () {
                    coercionUtil.binary('==', true, tS0, 42, tS1);
                    check([[tS0, cNumber, t0]]);
                });
                it('should handle number == object', function () {
                    coercionUtil.binary('==', 42, tS0, {}, tS1);
                    check([[tS1, cString, t0], [t0, cNumber, t1]]);
                });
                it('should handle string == object', function () {
                    coercionUtil.binary('==', 'foo', tS0, {}, tS1);
                    check([[tS1, cString, t0]])
                });
                it('should handle object == number', function () {
                    coercionUtil.binary('==', {}, tS0, 42, tS1);
                    check([[tS0, cString, t0], [t0, cNumber, t1]]);
                });
                it('should handle object == string', function () {
                    coercionUtil.binary('==', {}, tS0, 'foo', tS1);
                    check([[tS0, cString, t0]])
                });
                it('should handle object == string, with funky object', function () {
                    coercionUtil.binary('==', {
                        valueOf: function () {
                            return 42;
                        }
                    }, tS0, 'foo', tS1);
                    check([[tS0, cNumber, t0], [tS1, cNumber, t1]]);
                });
            });
            describe('bitwise operator coercions', function () {
                it('should handle string >> string', function () {
                    coercionUtil.binary('>>', 'foo', tS0, 'bar', tS1);
                    check([[tS0, cNumber, t0], [tS1, cNumber, t1]]);
                });
                it('should handle number >> number', function () {
                    coercionUtil.binary('>>', 42, tS0, 33, tS1);
                    check([]);
                });
                it('should handle number >> string', function () {
                    coercionUtil.binary('>>', 42, tS0, 'bar', tS1);
                    check([[tS1, cNumber, t0]]);
                });
            });
            describe('numeric operator coercions', function () {
                it('should handle string / string', function () {
                    coercionUtil.binary('/', 'foo', tS0, 'bar', tS1);
                    check([[tS0, cNumber, t0], [tS1, cNumber, t1]]);
                });
                it('should handle number / number', function () {
                    coercionUtil.binary('/', 42, tS0, 33, tS1);
                    check([]);
                });
                it('should handle number / string', function () {
                    coercionUtil.binary('/', 42, tS0, 'bar', tS1);
                    check([[tS1, cNumber, t0]]);
                });
            });
        });
    });
} finally {
    UNITTESTING = false;
}