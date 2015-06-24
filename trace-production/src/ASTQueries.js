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
// Esben Andreasen
/**
 * Supports misc. queries on the AST wrt. IIDs.
 */
var misc = require("./misc");
var astUtilForTracing = require("./astUtilForTracing");

var assert = misc.assert;

function ASTQueries() {

    // Lazy-initialized state that queries are answered with.
    var states = new Map();

    var ast_infos = {};

    /**
     * Query function for set-queries.
     */
    function has(queryType, sid, iid) {
        if (!states.has(sid)) {
            states.set(sid, new Map());
        }
        var state = states.get(sid);
        if (!state.has(queryType)) {
            state.set(queryType, new Set());
            ast_infos[sid][queryType].forEach(function (e, i) {
                state.get(queryType).add(e);
            });
        }
        return state.get(queryType).has(iid);
    }

    /**
     * Query function for map queries.
     */
    function get(queryType, sid, iid) {
        if (states[sid] === undefined) {
            states[sid] = {};
        }
        var state = states[sid];
        if (state[queryType] === undefined) {
            state[queryType] = new Map();
            ast_infos[sid][queryType].forEach(function (e, i) {
                state[queryType].set(e[0], e[1]);
            });
        }
        return state[queryType].get(iid);
    }

    return {
        isLazyBooleanResult: function isLazyBooleanResult(sid, iid, result) {
            return get('lazyBooleanLocations', sid, iid) === !!result;
        },
        isDynamicPropertyDeleteName: function isDynamicPropertyDeleteName(sid, iid) {
            return has('dynamicPropertyDeleteNames', sid, iid);
        },
        getFunctionEntryParameterCount: function getFunctionEntryParameterCount(sid, iid) {
            return get('parameterCounts', sid, iid);
        },
        isVoidedExpression: function (sid, iid) {
            return has('voidedExpressions', sid, iid);
        },
        isGlobalVariableDeclaration: function (sid, iid) {
            return has('globalVariableDeclarations', sid, iid);
        },
        isFunctionDeclaration: function (sid, iid) {
            return has('functionDeclarations', sid, iid);
        },
        isForInVariableUpdate: function (sid, iid) {
            return has('forInVariableUpdates', sid, iid);
        },
        registerASTInfo: function (sid, ast_info) {
            ast_infos[sid] = ast_info;
        }
    };
}

function makeASTInfo(instAST) {
    var astInfo = {
        lazyBooleanLocations: astUtilForTracing.computeLazyBooleanLocations((instAST)),
        dynamicPropertyDeleteNames: astUtilForTracing.computeDynamicPropertyDeleteNames((instAST)),
        parameterCounts: astUtilForTracing.computeParameterCounts((instAST)),
        voidedExpressions: astUtilForTracing.computeVoidedExpressions((instAST)),
        globalVariableDeclarations: astUtilForTracing.computeGlobalVariableDeclarations((instAST)),
        functionDeclarations: astUtilForTracing.computeFunctionDeclarations((instAST)),
        forInVariableUpdates: astUtilForTracing.computeForInVariableUpdates((instAST))
    };
    return astInfo;
}

exports.makeASTInfo = makeASTInfo;
exports.ASTQueries = ASTQueries;
