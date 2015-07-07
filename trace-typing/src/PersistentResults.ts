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
///<reference path="types.d.ts"/>
///<reference path="../typings/node/node.d.ts"/>
var temp = require("temp");
import fs = require("fs");
import ConfigLoader = require("./ConfigLoader");

var annotatedExperimentResultExtension = '.annotatedExperimentResults.json';

/**
 * Loads experiment results from disk.
 * Only loads most recent instance of identical experiments.
 */
export function load<T extends ExperimentResult>(kind:ExperimentResultKinds, callback:(results:AnnotatedExperimentResults<T>[]) => void):void {
    function filterToMostRecent(results:AnnotatedExperimentResults<T>[]) {
        var mostRecent = new Map<string, AnnotatedExperimentResults<T>>();
        var makeKey = function (r:AnnotatedExperimentResults<T>) {
            // silly equality key
            return JSON.stringify({sources: r.sources, description: r.description, kind: r.results[0].kind});
        };
        results.forEach(r => {
            var key = makeKey(r);
            if (!mostRecent.has(key) || mostRecent.get(key).sinceEpoch > r.sinceEpoch) {
                mostRecent.set(key, r);
            }
        });
        return results.filter(r => {
            return mostRecent.get(makeKey(r)) === r;
        });
    }

    var dir = ConfigLoader.load().experimentResultDirectory;
    fs.readdir(dir, (err:any, files:string[]) => {
        if (err) throw err;
        if (files.length === 0) {
            callback([]);
            return;
        }
        var results:AnnotatedExperimentResults<T>[] = [];
        var c = 0;
        files.forEach(function (file) {
            c++;
            fs.readFile(dir + '/' + file, 'utf-8', function (err, data) {
                if (err) throw err;
                if(file.indexOf(annotatedExperimentResultExtension) !== -1) {
                    var result = JSON.parse(data);
                    if (result.results[0].kind === kind) {
                        results.push(result); // manual type safety
                    }
                }
                if (0 === --c) {
                    callback(filterToMostRecent(results));
                }
            });
        });
    });
}

export function annotate<T extends ExperimentResult>(results:T[], sources:string[], description:string):AnnotatedExperimentResults<T> {
    return {
        sinceEpoch: +(new Date()),
        description: description,
        sources: sources,
        results: results
    };

}


/**
 * Saves experiments results to disk
 */
export function save(result:AnnotatedExperimentResults<any>, callback:Function) {
    var dir = ConfigLoader.load().experimentResultDirectory;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    temp.open({
        suffix: annotatedExperimentResultExtension,
        dir: dir
    }, function (err:any, info:any) {
        if (err) throw err;
        var json:string = JSON.stringify(result);
        fs.writeFile(info.path, json, callback);
    });
}

export enum ExperimentResultKinds {
    TypeComparisonQueryResult,
    InferredTypeResult,
    TypeChecksResult
}
