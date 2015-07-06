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
 * A complete implementation of the coercion rules in ECMAScript.
 * Identity-coercions are *not* performed.
 * Every coercion that is performed is registered by a traceBuilder.
 */
function isPrimitive(val) {
    var type = typeof val;
    return type === "string" || type === "number" || type === "boolean" || type === "undefined" || val === null;
}

function CoercionUtil(tmpGenerator, traceBuilder, coerceTypes, nativeSynthesisManager) {
    function coerceToConcretePrimitive(coercedValue, valueTmp, iid) {
        var coerceType;
        switch (typeof coercedValue) {
            case 'number':
                coerceType = coerceTypes.Number;
                break;
            case 'string':
                coerceType = coerceTypes.String;
                break;
            case 'boolean':
                coerceType = coerceTypes.Boolean;
                break;
            case 'undefined':
                coerceType = coerceTypes.Undefined;
                break;
            default:
                if (coercedValue === null) {
                    coerceType = coerceTypes.Null;
                    break;
                }
                // when this function is used, primitive coercions should already have happened!!
                throw new Error("coercedValue is not primitive: " + coercedValue);
        }
        return forcePrimitiveCoercion(coercedValue, valueTmp, coerceType, iid);
    }

    function forcePrimitiveCoercion(value, valueTmp, coerceType, iid) {
        var coercedTmp = tmpGenerator();
        var coercedValue;
        switch(coerceType){
            case coerceTypes.Number:
                coercedValue = +value;
                break;
            case coerceTypes.String:
                coercedValue = "" + value;
                break;
            case coerceTypes.Boolean:
                coercedValue = !coercedValue;
                break;
            case coerceTypes.Undefined:
                coercedValue = undefined;
                break;
            case coerceTypes.Null:
                coercedValue = null;
                break;
            default:
                throw new Error("Unhandled coercion: " + coerceType);
        }
        traceBuilder.infoBuilder.makeCoercion(valueTmp, coerceType, coercedTmp, iid);
        traceBuilder.makePrimitiveStatement(coercedValue, coercedTmp, iid);

        return coercedTmp;
    }

    function toObject(value, valueTmp, iid) {
        if (isPrimitive(value)) {
            var allocatedTmp;
            switch (typeof value) {
                case "string":
                    allocatedTmp = nativeSynthesisManager.allocate(new String(value));
                    break;
                case "number":
                    allocatedTmp = nativeSynthesisManager.allocate(new Number(value));
                    break;
                case "boolean":
                    allocatedTmp = nativeSynthesisManager.allocate(new Boolean(value));
                    break;
                default:
                    throw new Error("Unhandled coercion: " + typeof value + " -> Object");
            }
            traceBuilder.infoBuilder.makeCoercion(valueTmp, coerceTypes.Object, allocatedTmp, iid);
            return allocatedTmp;
        }
        return valueTmp;
    }

    function toBoolean(value, valueTmp, iid) {
        if (typeof value !== 'boolean') {
            return forcePrimitiveCoercion(value, valueTmp, coerceTypes.Boolean, iid);
        }
        return valueTmp;
    }

    function toNumber(value, valueTmp, iid) {
        if (typeof value !== 'number') {
            return forcePrimitiveCoercion(value, valueTmp, coerceTypes.Number, iid);
        }
        return valueTmp;
    }

    function toString(value, valueTmp, iid) {
        if (typeof value !== 'string') {
            return forcePrimitiveCoercion(value, valueTmp, coerceTypes.String, iid);

        }
        return valueTmp;
    }

    var toInt32 = toNumber, toUInt32 = toNumber;

    function unary(op, value, valueTmp, iid) {
        switch (op) { // switch cases from analysis2.js
            case "+":
                return toNumber(value, valueTmp, iid);
            case "-":
                return toNumber(value, valueTmp, iid);
            case "~":
                return toInt32(value, valueTmp, iid);
            case "!":
                return toBoolean(value, valueTmp, iid);
            case "typeof":
                return valueTmp;
            default:
                throw new Error(op + " at " + iid + " not found");
                break;
        }
    }

    var PrimitiveHints = {
        Number: "Number",
        String: "String",
        None: "None"
    };
    var Types = {
        Undefined: 'Undefined',
        Null: 'Null',
        Boolean: 'Boolean',
        String: 'String',
        Number: 'Number',
        Object: 'Object'
    };

    /**
     * typeof-like function, but with respect to Types: ECMA 8.0
     */
    function getType(value) {
        if (value === null) {
            return Types.Null;
        }
        switch (typeof value) {
            case "undefined":
                return Types.Undefined;
            case "boolean":
                return Types.Boolean;
            case "string":
                return Types.String;
            case "number":
                return Types.Number;
            default:
                return Types.Object;
        }
    }

// ECMA 8.12.8
    function toDefault(value, valueTmp, hint, iid) {
        if (hint === PrimitiveHints.None) {
            if (value instanceof Date) {
                hint = PrimitiveHints.String;
            } else {
                hint = PrimitiveHints.Number;
            }
        }
        // NB the rest of this function is not side-effect free if value.toString or value.valueOf has side-effects!
        if (hint == PrimitiveHints.String) {
            if (typeof value.toString === 'function') {
                var coercedValue = value.toString();
                if (isPrimitive(coercedValue)) {
                    return [coercedValue, coerceToConcretePrimitive(coercedValue, valueTmp, iid)];
                }
            }
            if (typeof value.valueOf === 'function') {
                var coercedValue = value.valueOf();
                return [coercedValue, coerceToConcretePrimitive(coercedValue, valueTmp, iid)];
            }
            throw new Error("Can perform coercion: " + value);
        }
        if (hint === PrimitiveHints.Number) {
            if (typeof value.valueOf === 'function') {
                var coercedValue = value.valueOf();
                if (isPrimitive(coercedValue)) {
                    return [coercedValue, coerceToConcretePrimitive(coercedValue, valueTmp, iid)];
                }
            }
            if (typeof value.toString === 'function') {
                var coercedValue = value.toString();
                return [coercedValue, coerceToConcretePrimitive(coercedValue, valueTmp, iid)];
            }
            throw new Error("Can perform coercion: " + value);
        }
        throw new Error("Unhandled toPrimitive hint: " + hint);
    }

// ECMA 9.1
    function toPrimitive(value, valueTmp, hint, iid) {
        if (typeof value === 'object' && value !== null) {
            return toDefault(value, valueTmp, hint, iid);
        }
        return [value, valueTmp];
    }

    function binary(op, leftValue, leftTmp, rightValue, rightTmp, iid) {
        switch (op) { // switch cases from analysis2.js
            // multiplicative operators: ECMA 11.5
            case "*":
            case "/":
            case "%":
                return [toNumber(leftValue, leftTmp, iid), toNumber(rightValue, rightTmp, iid)];
            // additive operators: ECMA 11.6
            case "+":
                var lprimPair = toPrimitive(leftValue, leftTmp, PrimitiveHints.None, iid);
                var rprimPair = toPrimitive(rightValue, rightTmp, PrimitiveHints.None, iid);
                if ((getType(lprimPair[0]) === Types.String ) || (getType(rprimPair[0]) === Types.String)) {
                    return [toString(lprimPair[0], lprimPair[1], iid), toString(rprimPair[0], rprimPair[1], iid)]
                }
                return [toNumber(lprimPair[0], lprimPair[1], iid), toNumber(rprimPair[0], rprimPair[1], iid)]
            case "-":
                return [toNumber(leftValue, leftTmp, iid), toNumber(rightValue, rightTmp, iid)];
            // bitwise shift operators: ECMA 11.7
            case "<<":
            case ">>":
                return [toInt32(leftValue, leftTmp, iid), toUInt32(rightValue, rightTmp, iid)];
            case ">>>":
                return [toUInt32(leftValue, leftTmp, iid), toUInt32(rightValue, rightTmp, iid)];
            // relational operators: ECMA 11.8
            case "<":
            case ">":
            case "<=":
            case ">=":
                // all done with the abstract relational comparison algorithm: ECMA 11.8.5
                // (we can ignore the LeftFirst flag as the arguments have not been swapped for a precise boolean result, we only care about the type)
                var pxPair = toPrimitive(leftValue, leftTmp, PrimitiveHints.Number, iid);
                var pyPair = toPrimitive(rightValue, rightTmp, PrimitiveHints.Number, iid);
                var coercedLeftTmp, coercedRightTmp;
                if (!(typeof pxPair[0] === 'string' && typeof pyPair[0] === 'string')) {
                    // keep coercing
                    coercedLeftTmp = toNumber(pxPair[0], pxPair[1], iid);
                    coercedRightTmp = toNumber(pyPair[0], pyPair[1], iid);
                } else {
                    coercedLeftTmp = pxPair[1];
                    coercedRightTmp = pyPair[1];
                }
                return [coercedLeftTmp, coercedRightTmp];
            //      ... ECMA 11.8.6 + 11.8.7
            case "instanceof":
            case "in":
                return [leftTmp, rightTmp];
            // equality operators: 11.9
            case "==":
            case "!=":
            {
                // all done with the abstract equality comparison algorithm: ECMA 11.9.3
                function equality(leftValueTmpPair, rightValueTmpPair /* convenient signature for recursive calls */) {
                    var leftValue = leftValueTmpPair[0];
                    var leftTmp = leftValueTmpPair[1];
                    var rightValue = rightValueTmpPair[0];
                    var rightTmp = rightValueTmpPair[1];

                    var typeX = getType(leftValue);
                    var typeY = getType(rightValue);
                    // .1
                    if (typeX === typeY) {
                        return [leftTmp, rightTmp];
                    }
                    // .2 .3
                    if ((leftValue === null && rightValue === undefined) || (leftValue === undefined && rightValue === null)) {
                        return [leftTmp, rightTmp];
                    }
                    // .4
                    if (typeX === Types.Number && typeY === Types.String) {
                        return equality(leftValueTmpPair, [+rightValue, toNumber(rightValue, rightTmp)]);
                    }
                    // .5
                    if (typeX === Types.String && typeY === Types.Number) {
                        return equality([+leftValue, toNumber(leftValue, leftTmp)], rightValueTmpPair);
                    }
                    // .6
                    if (typeX === Types.Boolean) {
                        return equality([+leftValue, toNumber(leftValue, leftTmp)], rightValueTmpPair);
                    }
                    // .7
                    if (typeY === Types.Boolean) {
                        return equality(leftValueTmpPair, [+rightValue, toNumber(rightValue, rightTmp)]);
                    }
                    // .8
                    if ((typeX === Types.String || typeX === Types.Number) && typeY === Types.Object) {
                        var rprimPair = toPrimitive(rightValue, rightTmp, PrimitiveHints.None);
                        return equality(leftValueTmpPair, rprimPair);
                    }
                    // .9
                    if ((typeY === Types.String || typeY === Types.Number) && typeX === Types.Object) {
                        var lprimPair = toPrimitive(leftValue, leftTmp, PrimitiveHints.None);
                        return equality(lprimPair, rightValueTmpPair);
                    }
                    return [leftValueTmpPair, rightValueTmpPair]
                }

                var result = equality([leftValue, leftTmp], [rightValue, rightTmp]);
                return [result[0][1], result[1][1]];
            }
            case "===":
            case "!==":
                return [leftTmp, rightTmp];
            case "&":
            case "|":
            case "^":
                return [toInt32(leftValue, leftTmp, iid), toInt32(rightValue, rightTmp, iid)];
            case "delete":
                throw new Error("Coercion for delete is handled explicitly in analysis.binary");
            default:
                throw new Error(op + " at " + iid + " not found");
        }
    }

    this.unary = unary;
    this.binary = binary;
    this.toObject = toObject;
    this.toBoolean = toBoolean;
}

exports.CoercionUtil = CoercionUtil;
