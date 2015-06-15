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
export class VariablesImpl<T> implements Variables<T> {
    private state:Map<Variable, T> = new Map<Variable, T>();

    read(variable:Variable, allowUndefined:boolean = false):T {
        if (!this.state.has(variable)) {
            if(allowUndefined){
                return undefined;
            }
            throw new Error("Variable not in variable state: " + JSON.stringify(variable));
        }
        var pair = this.state.get(variable);
        if (pair === undefined) {
            throw new Error("Variable value not in variable state (missing environment modelling?)" + JSON.stringify(variable));
        }
        return pair;
    }

    write(variable:Variable, value:T) {
        this.state.set(variable, value)
    }
}
