/*
 * Copyright 2015 Samsung Information Systems America, Inc.
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


var coerceTypes = {
    Object: 'Object',
    Boolean: 'Boolean',
    Number: 'Number',
    String: 'String',
    // these last two types can occur when toString or valueOf are used
    Null: 'Null',
    Undefined: 'Undefined'
}

var infoKinds = {FUNCTION_RETURN: "FUNCTION_RETURN", FUNCTION_RESULT: "FUNCTION_RESULT", FUNCTION_INVOCATION: "FUNCTION_INVOCATION", FUNCTION_ENTER: "FUNCTION_ENTER", COERCION: "COERCION", NEXT_FIELD_ACCESS_IS_DYNAMIC: "NEXT_FIELD_ACCESS_IS_DYNAMIC", NEXT_NEW_IS_ARRAY: "NEXT_NEW_IS_ARRAY", NEXT_NEW_IS_ARGUMENTS: "NEXT_NEW_IS_ARGUMENTS", FOR_IN_OBJECT: "FOR_IN_OBJECT", NEXT_NEW_IS_DOT_PROTOTYPE: "NEXT_NEW_IS_DOT_PROTOTYPE", NEXT_NEW_IS_FUNCTION: "NEXT_NEW_IS_FUNCTION"};
var elementKinds = {};
"WRITE FIELD_WRITE DELETE INFO READ FIELD_READ NEW PRIMITIVE".split(" ").forEach(
    function (e, i) {
        elementKinds[e] = e;
    }
);

var visitorMethodNames =
    "PreWrite PostWrite FieldWrite Delete Info Read New Primitive".split(" ").
        map(function (e) {
            return "visit" + e
        });

function walkElement(element, visitor) {
    var p = element.properties;
    switch (element.kind) {
        case elementKinds.WRITE:
        {
            if (visitor.visitPreWrite) {
                visitor.visitPreWrite(p.sinkTmp, p.sourceExpression);
            }
            walkElement(p.sourceExpression, visitor);
            if (visitor.visitPostWrite) {
                visitor.visitPostWrite(p.sinkTmp, p.sourceExpression);
            }
            break;
        }
        case elementKinds.FIELD_WRITE:
        {
            if (visitor.visitFieldWrite) {
                visitor.visitFieldWrite(p.baseTmp, p.fieldName, p.sourceTmp, p.isInitializer);
            }
            break;
        }
        case elementKinds.DELETE :
        {
            if (visitor.visitDelete) {
                visitor.visitDelete(p.baseTmp, p.fieldName);
            }
            break;
        }
        case elementKinds.INFO:
        {
            if (visitor.visitInfo) {
                var infoProperties = [];
                for(var name in p){
                    if(p.hasOwnProperty(name)){
                        infoProperties.push(p[name]);
                    }
                }
                visitor.visitInfo.apply(visitor, infoProperties);
            }
            break;
        }
        case elementKinds.READ :
        {
            if (visitor.visitRead) {
                visitor.visitRead(p.sourceTmp);
            }
            break;
        }
        case elementKinds.FIELD_READ :
        {
            if (visitor.visitFieldRead) {
                visitor.visitFieldRead(p.baseTmp, p.fieldName);
            }
            break;
        }
        case elementKinds.NEW :
        {
            if (visitor.visitNew) {
                visitor.visitNew(p.prototypeTmp);
            }
            break;
        }
        case elementKinds.PRIMITIVE :
        {
            if (visitor.visitPrimitive) {
                visitor.visitPrimitive(p.value);
            }
            break;
        }

    }
}

function elementToString(e) {
    var p = e.properties;
    var toStrings = {};
    toStrings[elementKinds.WRITE] = function () {
        return p.sinkTmp + " = " + elementToString(p.sourceExpression);
    };
    toStrings[elementKinds.FIELD_WRITE] = function () {
        return p.baseTmp + "." + p.fieldName + " = " + p.sourceTmp + (p.isInitializer? "(init)": "");
    };
    toStrings[elementKinds.DELETE] = function () {
        return "delete " + p.baseTmp + "." + p.fieldName;
    };
    toStrings[elementKinds.INFO] = function () {
        return "INFO: " + p.msg;
    };
    toStrings[elementKinds.READ] = function () {
        return p.sourceTmp;
    };
    toStrings[elementKinds.FIELD_READ] = function () {
        return p.baseTmp + "." + p.fieldName;
    };
    toStrings[elementKinds.NEW] = function () {
        return "{} with prototype " + p.prototypeTmp;
    };
    toStrings[elementKinds.PRIMITIVE] = function () {
        return p.value + "";
    };
    return toStrings[e.kind]();
}

exports.walkElement = walkElement;
exports.visitorMethodNames = visitorMethodNames;
exports.elementKinds = elementKinds;
exports.infoKinds = infoKinds;
exports.coerceTypes = coerceTypes;
exports.elementToString = elementToString;
