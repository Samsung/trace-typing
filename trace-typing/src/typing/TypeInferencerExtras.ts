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
import TypeImpls = require('./TypeImpls');
import Misc = require('../Misc');

/**
 * Misc. Utilities for TypeInferencer.
 */


/**
 * Makes the merge operator for merging functions based with merging arguments pairwise as well as merging the return types.
 * // TODO remove completely or move back to the TypeInferencer?
 */
export function makeMergeFunctionTypesPointwise(baseMerge:MergeOperator<TupleType>, argMerge:MergeOperator<TupleType>, resultMerge:MergeOperator<TupleType>):(t1:FunctionType, t2:FunctionType) => SingleFunctionType /* slightly more precise than the usual merge operator */ {
    /**
     * Unwraps intersection function types by merging them
     */
    function intersectionFunctionType2SingleFunctionType(it:IntersectionFunctionType, merge:(t1:FunctionType, t2:FunctionType) => SingleFunctionType) {
        var st = it.members[0];
        for (var i = 1; i < it.members.length; i++) {
            st = merge(st, it.members[i]);
        }
        return st;
    }

    return function merge(t1:FunctionType, t2:FunctionType):SingleFunctionType {
        // TODO: this function merge architecture is not very scalable: every function type will have to be handled here?!
        function functionType2singleFunctionType(t:FunctionType) {
            var st:SingleFunctionType;
            switch (t.functionKind) {
                case TypeImpls.FunctionKinds.Intersection:
                    st = intersectionFunctionType2SingleFunctionType((<IntersectionFunctionType>t), merge);
                    break;
                case TypeImpls.FunctionKinds.Single:
                    st = <SingleFunctionType>t;
                    break;
                default:
                    throw new Error("Unhandled function kind: " + t.functionKind)
            }
            return st;
        }

        var st1:SingleFunctionType = functionType2singleFunctionType(t1);
        var st2:SingleFunctionType = functionType2singleFunctionType(t2);
        var as1 = st1.args;
        var as2 = st2.args;
        var mergedArgs:TupleType[] = [];
        for (var i = 0; i < as1.length; i++) {
            if (Misc.HOP(as1, i + '') && Misc.HOP(as2, i + '')) {
                var ta1:TupleType = as1[i];
                var ta2:TupleType = as2[i];
                var mergedArg = argMerge(ta1, ta2);
                mergedArgs[i] = mergedArg;
            }
        }
        var mergedBaseTypes = baseMerge(st1.base, st2.base);
        var mergedFunctionTypes = resultMerge(st1.result, st2.result);
        var callKinds = Misc.mergeFlatSets(st1.callKinds, st1.callKinds);
        return new TypeImpls.SingleFunctionTypeImpl(mergedBaseTypes, mergedArgs, mergedFunctionTypes, callKinds);
    };
}
