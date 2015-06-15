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
///<reference path="../types.d.ts"/>
import MetaInformationExplainer = require("../MetaInformationExplainer");

/**
 * Misc utilities for TraceReplayer
 */


export function showDefinitionChain(variable:Variable, statements:TraceStatement[], explainer:MetaInformationExplainer) {
    var targets = new Set<Variable>();
    targets.add(variable);
    var chain:Write[] = [];
    var expressionVisitor:TraceExpressionVisitor<void> = {
        visitRead: function (e:Read):void {
            targets.add(e.source);
        },
        visitFieldRead: function (e:FieldRead):void {
        },
        visitNew: function (e:New):void {
        },
        visitPrimitiveExpression: function (e:PrimitiveExpression):void {
        }
    };
    var statementVisitor:TraceStatementVisitor<void> = {
        visitWrite: function (e:Write):void {
            if (targets.has(e.sink)) {
                targets.delete(e.sink);
                chain.push(e);
                e.rhs.applyExpressionVisitor(expressionVisitor);
            }
        },
        visitFieldWrite: function (e:FieldWrite):void {
        },
        visitDelete: function (e:Delete):void {
        },
        visitInfo: function (e:Info):void {
        }
    };
    for (var i = statements.length - 1; i >= 0; i--) {
        statements[i].applyStatementVisitor(statementVisitor);
    }
    chain.reverse();
    console.log("Definition chain for %s:", JSON.stringify(variable));
    function getLocation(e:TraceElement) {
        return explainer.getIIDSourceLocation(e.meta.iid).toString();
    }

    chain.forEach(function (e:TraceElement) {
        console.log("    %s at %s", e.toString(), getLocation(e));
    });
}

