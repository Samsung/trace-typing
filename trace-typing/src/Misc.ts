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
/// <reference path="./types.d.ts"/>
import SJS = require('./SJS');

export class Some<T> implements Option<T> {
    public isSome = true;

    constructor(public value:T) {
    }
}

export class None<T> implements Option<T> {
    public isSome = false;
}

export function isAbstractFieldName(fieldName:string) {
    return isAbstractArrayFieldName(fieldName) || isAbstractMapFieldName(fieldName);
}
export function isAbstractArrayFieldName(fieldName:string) {
    return abstractArrayFieldName === fieldName;
}
export function isAbstractMapFieldName(fieldName:string) {
    return abstractMapFieldName === fieldName;
}

export function getAbstractMapFieldName(){
    return abstractMapFieldName;
}

export function getAbstractArrayFieldName(){
    return abstractArrayFieldName;
}

var abstractMapFieldName = '__TT_MAP_INDEX__';
var abstractArrayFieldName = '__TT_ARRAY_INDEX__';

export function fieldNameAbstraction(fieldName:string, classification:ObjectClassificationType):string {
    if (classification.classifications.has(SJS.ObjectClassification.Map)) {
        return abstractMapFieldName;
    }
    var integral = parseInt(fieldName) /* NB: parseInt('1.5') === 1 */;
    var isArguments = classification.classifications.has(SJS.ObjectClassification.Arguments);
    if (fieldName !== 'NaN' && fieldName === (integral + '') && !isArguments) {
        return abstractArrayFieldName;
    }
    return fieldName;
}

export function isSetFlatEqual<T>(s1:Set<T>, s2:Set<T>) {
    if (s1.size !== s2.size) {
        return false;
    }

    var containsAll = true;
    s1.forEach(e => containsAll = containsAll && s2.has(e));
    return containsAll;
}

export function mergeFlatSets<T>(s1:Set<T>, s2:Set<T>) {
    if(isSetFlatEqual(s1, s2)){
        return s1;
    }
    var merged = new Set<T>();
    s1.forEach(e => merged.add(e));
    s2.forEach(e => merged.add(e));
    return merged;
}
export function HOP(o:any, p:string) {
    return Object.prototype.hasOwnProperty.call(o, p);
}
