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

interface GroupByProjection<T, R> {
    (e:T): R
}
function group<T,R>(ungrouped:T[], by:GroupByProjection<T,R>):T[][] {
    var key2indexMap = new Map<R, number>();
    var groups:T[][] = [];
    ungrouped.forEach(function (e:T) {
        var id:R = by(e);
        if (!key2indexMap.has(id)) {
            key2indexMap.set(id, groups.length);
            groups.push([])
        }
        var group = groups[key2indexMap.get(id)];
        group.push(e);
    });
    return groups;
}
class ValueGrouper {

    constructor(private instances:Instance[], private dynamicFunctionSignatures:DynamicFunctionSignature[], private explainer:MetaInformationExplainer) {

    }

    groupFunctionCallsByCallSite():DynamicFunctionSignature[][] {
        return group(this.dynamicFunctionSignatures, function (signature:DynamicFunctionSignature):string {
            return signature.meta.iid;
        });
    }

    groupObjectsByInstance():Shape[][] {
        return this.instances.map(i => i.shapes);
    }
}
