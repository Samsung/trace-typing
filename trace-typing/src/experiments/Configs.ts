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
import TypeLattices = require("../typing/TypeLattices");

// TODO gather all the configuration classes spread around the code base, including the string parsing of Playground...

/**
 * Simple string based interface for creating experiments by the names of each component.
 * (see Playground.ts for what the names are) // TODO change this dependency?
 */
export class ExperimentStringConfig implements ExperimentConfig {
    public typeLatticeMaker:() => ValueTypeConfig;
    public precisionConfig:PrecisionConfig;

    constructor(types:string[], precision:string[]) {
        this.precisionConfig = {};
        precision.forEach(f => (<any>this.precisionConfig)[f] = true);

        this.typeLatticeMaker = function ():ValueTypeConfig {
            return TypeLattices.makeLatticeFromStrings(types);
        }
    }
}
