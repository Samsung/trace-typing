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
///<reference path="./types.d.ts"/>
var canonicalVars = new Map<string, Variable>();
var mkVarCache = new Map<string, Variable>();

function parseTokens(tokens:string[]):Variable {
    switch (tokens[0]) {
        case 'magic':
            return {
                named: false,
                name: tokens[1]
            };
            break;
        case 'intermediary':
            return {
                named: false,
                name: tokens[1],
                functionIID: tokens[2],
                callCount: tokens[3]
            };
            break;
        case 'var':
            return {
                named: true,
                name: tokens[1],
                functionIID: tokens[2],
                callCount: tokens[3]
            };
            break;
        case 'expr':
            return {
                named: false,
                iid: tokens[1],
                functionIID: tokens[2],
                callCount: tokens[3]
            };
            break;
        case 'merge':
            return {
                forceMerge: true,
                named: false,
                iid: tokens[1],
                functionIID: tokens[2],
                callCount: tokens[3]
            };
            break;
        default:
            throw new Error("Unhandled variable type: " + tokens[0]);
    }
}

export function mkVar(text:string) {
    if (mkVarCache.has(text)) {
        return mkVarCache.get(text);
    }
    var canonicalized = canonicalize(parseTokens(text.split(":")));
    mkVarCache.set(text, canonicalized);
    return canonicalized;
}
export function variableToString(variable:Variable):string {
    return '' + (variable.name ? variable.name : variable.iid) + ',' + variable.functionIID + ',' + variable.callCount;
};

export function canonicalize(variable:Variable) {
    var key = variableToString(variable);
    if (!canonicalVars.has(key)) {
        canonicalVars.set(key, variable);
    }
    return canonicalVars.get(key);
}

export function getCoreModuleVar(name:string) {
    return mkVar("core_module:" + name);
}

export function getGlobalVar() {
    return mkVar("magic:global");
}
