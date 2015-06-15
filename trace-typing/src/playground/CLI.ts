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
///<reference path="../../typings/node/node.d.ts"/>

import Playground = require("./Playground");
import path = require("path");

function handleError(e:any) {
    console.log();
    console.log("Usage: .bin/play.sh EXPERIMENT_NAME FILE [DIR] [IIDS]")
    console.log("Example usage: ./bin/play.sh " + Playground.Playground.getExampleExperimentName() + " test/fixtures/optparse-singlefile.js");
    console.log();
    console.log(Playground.Playground.getAPIExplanationString());
    console.log();
    console.error("Something went wrong:\n" + e);
    process.exit(1);
}

try {
    var experimentName = process.argv[2];
    var fileName = process.argv[3];
    var dir:string = undefined;
    if (process.argv.length >= 5) {
        dir = process.argv[4];
    }

    var iidFilter:string[];

    if (process.argv.length >= 6) {
        iidFilter = process.argv[5].split(",");
    } else {
        iidFilter = undefined;
    }

    new Playground.Playground().playWithoutTest({
        target: path.extname(fileName) === ".trace"? new Playground.PlayTraceTarget(fileName):  new Playground.PlayFileTarget(fileName, dir),
        experimentName: experimentName,
        browser: true,
        stdout: true,
        iidFilter: iidFilter
    }, function (e:any) {
        if (e) {
            handleError(e);
        }
    });
} catch (e) {
    handleError(e);
}
