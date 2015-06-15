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
import AST = require("../TraceLanguageAST");

function showPropertyHistories(instances:Instance[], withValues:boolean, toStdOut:boolean) {
    var instanceCounter = 0;
    var instanceCounterMap = new Map<Instance, number>();
    instances.forEach(function (instance:Instance) {
        instanceCounterMap.set(instance, instanceCounter);
        instanceCounter++;
    });

    function getObjectName(instance:Instance) {
        return "<Instance#" + instanceCounterMap.get(instance) + ">";
    }

    function valueToString(value:Value):string {
        if (instanceCounterMap.has(<Instance>value)) {
            return getObjectName(<Instance>value);
        }
        // must be primitive
        if ((<Primitive>value).primitiveKind !== undefined) {
            return AST.PrimitiveKind[(<Primitive>value).primitiveKind];
        }
        throw new Error("Unknown value type: " + value);
    }

    function makePropertyList(shape:Shape, withValues:boolean):string[] {
        var list:string[] = [];
        shape.getPropertyNames().forEach(function (name) {
            list.push(name + (withValues ? ": " + valueToString(shape.getPropertyValue(name)) : ""));
        });
        return list;
    }

    instances.forEach(function (instance:Instance) {
        var propertyHistory = getObjectName(instance) + ": ";
        var indentSize = propertyHistory.length;
        var indent = "";
        for (var i = 0; i < indentSize; i++) {
            indent += " ";
        }
        var first = true;
        instance.shapes.forEach(function (shape:Shape) {
            if (!first) {
                propertyHistory += "\n" + indent;
            }
            first = false;
            propertyHistory += "{" + makePropertyList(shape, withValues).join(", ") + "}";
        });
        if (toStdOut) {
            console.log(propertyHistory);
        }
    });

}
class HeapHistoryVisualizer {
    constructor(private instances:Instance[]) {
    }

    public showPropertyNameHistories(toStdOut:boolean) {
        showPropertyHistories(this.instances, false, toStdOut);

    }

    public showPropertyHistories(toStdOut:boolean) {
        showPropertyHistories(this.instances, true, toStdOut);
    }
}
export = HeapHistoryVisualizer;
