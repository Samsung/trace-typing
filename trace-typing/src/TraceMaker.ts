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
///<reference path="../typings/node/node.d.ts"/>
///<reference path="./types.d.ts"/>
import ConfigLoader = require('./ConfigLoader');
import TraceImporter = require("./TraceImporter");
import HeapHistoryBuilder = require("./trace-replaying/TraceReplayer");
var temp = require('temp'),
    fs = require('fs');

function parseJSONFile(file:string, callback:Function) {
    fs.readFile(file, 'utf8', function (err:any, content:string) {
        if (err) {
            throw err;
        }
        callback(JSON.parse(content));
    });
}

export interface TraceCallback {
    (err:any, trace:Trace):void
}

/**
 * Useful for small source-inlined snippets
 */
export function getTraceFromSource(source:string, callback:TraceCallback) {
    var fileName = temp.path({suffix: '.js'});
    fs.writeFile(fileName, source, function (err:any) {
        if (err) {
            callback(err, undefined);
            return;
        }
        getTraceFromSourceFile(fileName, callback);
    });
}

export function getTraceFromDir(target:Target, callback:TraceCallback) {
    ConfigLoader.load().makeTrace(target, function (err:any, externalTrace:any[], smap:any) {
        if (err) {
            callback(err, undefined);
            return;
        }
        var trace:Trace = TraceImporter.deserializeNaiveTrace(externalTrace, smap);
        callback(undefined, trace);
    }, false);
};
export function getTraceFromSourceFile(sourceFile:string, callback:TraceCallback):void {
    getTraceFromDir({main: sourceFile}, callback);
}
