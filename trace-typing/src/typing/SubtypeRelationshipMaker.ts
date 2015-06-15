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

class SubtypeRelationshipMaker {
    private static identityCache = new Map<Shape, Map<Shape, SubtypeRelationship>>();

    public static make(subtype:Shape, supertype:Shape):SubtypeRelationship {
        var cache = SubtypeRelationshipMaker.identityCache;
        if (!cache.has(subtype)) {
            cache.set(subtype, new Map<Shape, SubtypeRelationship>());
        }
        if (!cache.get(subtype).has(supertype)) {
            var relationship = {subtype: subtype, supertype: supertype};
            cache.get(subtype).set(supertype, relationship);
        }
        return cache.get(subtype).get(supertype);
    }
}

export = SubtypeRelationshipMaker;
