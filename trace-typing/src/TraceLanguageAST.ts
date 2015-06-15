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

/// <reference path="./types.d.ts"/>

function varString(variable:Variable){
    return JSON.stringify(variable);
}
export class WriteImpl implements Write {
    constructor(public sink:Variable, public rhs:TraceExpression, public meta:TraceElementMetaInformation) {
    }

    toString():string {
        return varString(this.sink) + " = " + this.rhs.toString();
    }

    applyVisitor<E>(visitor:TraceElementVisitor<E>):E {
        return visitor.visitWrite(this);
    }

    applyStatementVisitor<E>(visitor:TraceStatementVisitor<E>):E {
        return visitor.visitWrite(this);
    }
}

export class FieldWriteImpl implements FieldWrite {
    constructor(public base:Variable, public fieldName:string, public rhs:Variable, public isInitializer:boolean, public meta:TraceElementMetaInformation) {
    }

    toString():string {
        return varString(this.base) + "." + this.fieldName + " = " + varString(this.rhs);
    }

    applyVisitor<E>(visitor:TraceElementVisitor<E>):E {
        return visitor.visitFieldWrite(this);
    }

    applyStatementVisitor<E>(visitor:TraceStatementVisitor<E>):E {
        return visitor.visitFieldWrite(this);
    }
}

export class DeleteImpl implements Delete {
    constructor(public base:Variable, public fieldName:string, public meta:TraceElementMetaInformation) {
    }

    toString():string {
        return "delete " + varString(this.base) + "." + this.fieldName;
    }

    applyVisitor<E>(visitor:TraceElementVisitor<E>):E {
        return visitor.visitDelete(this);
    }

    applyStatementVisitor<E>(visitor:TraceStatementVisitor<E>):E {
        return visitor.visitDelete(this);
    }
}
export class InfoImpl implements Info {
    constructor(public kind:InfoKinds, public properties:InfoProperties, public meta:TraceElementMetaInformation) {
    }

    toString():string {
        return "INFO(" + InfoKinds[this.kind] + ", " + JSON.stringify(this.properties) + ")";
    }

    applyVisitor<E>(visitor:TraceElementVisitor<E>):E {
        return visitor.visitInfo(this);
    }

    applyStatementVisitor<E>(visitor:TraceStatementVisitor<E>):E {
        return visitor.visitInfo(this);
    }
}
export class ReadImpl implements Read {
    constructor(public source:Variable, public meta:TraceElementMetaInformation) {

    }

    toString():string {
        return varString(this.source);
    }

    applyVisitor<E>(visitor:TraceElementVisitor<E>):E {
        return visitor.visitRead(this);
    }

    applyExpressionVisitor<E>(visitor:TraceExpressionVisitor<E>):E {
        return visitor.visitRead(this);
    }
}

export class FieldReadImpl implements FieldRead {
    constructor(public base:Variable, public fieldName:string, public modelingHack:ModelingHack, public meta:TraceElementMetaInformation) {
    }

    toString():string {
        return varString(this.base) + "." + this.fieldName.toString();
    }

    applyVisitor<E>(visitor:TraceElementVisitor<E>):E {
        return visitor.visitFieldRead(this);
    }

    applyExpressionVisitor<E>(visitor:TraceExpressionVisitor<E>):E {
        return visitor.visitFieldRead(this);
    }
}
export class NewImpl implements New {
    constructor(public proto:Variable, public meta:TraceElementMetaInformation) {
    }

    toString():string {
        return "{} with prototype " + varString(this.proto);
    }

    applyVisitor<E>(visitor:TraceElementVisitor<E>):E {
        return visitor.visitNew(this);
    }

    applyExpressionVisitor<E>(visitor:TraceExpressionVisitor<E>):E {
        return visitor.visitNew(this);
    }

}

export class PrimitiveImpl implements PrimitiveExpression {
    constructor(public value:PrimitiveKind, public meta:TraceElementMetaInformation) {
    }

    toString():string {
        return PrimitiveKind[this.value];
    }

    applyVisitor<E>(visitor:TraceElementVisitor<E>):E {
        return visitor.visitPrimitiveExpression(this);
    }

    applyExpressionVisitor<E>(visitor:TraceExpressionVisitor<E>):E {
        return visitor.visitPrimitiveExpression(this);
    }

}

export enum PrimitiveKind{
    Number,
    String,
    Boolean,
    Undefined,
    Null
}
export enum ValueKinds{
    Primitive,
    Object
}
export enum CoerceTypes {
    Object,
    Number,
    String,
    Boolean,
    Null,
    Undefined
}
export enum InfoKinds{
    FunctionInvocation,
    FunctionEnter,
    FunctionReturn,
    FunctionResult,
    Coerce,
    NextFieldAccessIsDynamic,
    NextNewIsArray,
    NextNewIsFunction,
    NextNewIsArguments,
    ForInObject,
    NextNewIsDotPrototype
}
