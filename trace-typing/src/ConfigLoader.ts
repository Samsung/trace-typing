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
///<reference path="types.d.ts"/>
var fs = require('fs');
var path = require('path');

var rootDir = path.resolve(__dirname + "../../..");
var defaultConfigLocation = rootDir + "/config.default.js";
var loadedConfig:StringConfig = undefined;
interface StringConfig {
    [name:string]:string
}
function load():StringConfig {
    if (loadedConfig !== undefined) {
        return loadedConfig;
    }
    var defaultConfig = require(defaultConfigLocation).config;

    var configs:StringConfig[] = [];

    configs.push(defaultConfig);

    var configLocation = rootDir + "/config.js";
    if (fs.existsSync(configLocation)) {
        configs.push(require(configLocation).config);
    }

    var combinedConfig:StringConfig = {};

    for (var i in configs) {
        var config = configs[i];
        for (var p in config) {
            combinedConfig[p] = config[p];
        }
    }
    loadedConfig = combinedConfig;
    return combinedConfig;
};

class ConfigImpl implements Config {
    constructor(public experimentResultDirectory:string, public tracesDirectory:string, public makeTrace:MakeTraceFunction) {
    }
}
interface Promise {
    // ad hoc Promise definition
    done(): void
    then(f:() => void): Promise
}


class ConfigLoader {
    static load():Config {
        var config:StringConfig = load();
        return new ConfigImpl(config["experimentResultDirectory"], config["tracesDirectory"], function (target:Target, callback:(err:any, externalTrace:any[], smap:any) => void, debug:boolean) {
            var trace:any[];
            var smap:any;
            var q:Promise = require("trace-production").run(target, (err:any, t:any[], s:any) => {
                if (err) {
                    callback(err, undefined, undefined);
                }
                trace = t, smap = s
            }, debug)
                .then(function () {
                    if (trace === undefined) {
                        callback(new Error("Undefined traceFile!?!"), undefined, undefined);
                        return;
                    }
                    callback(undefined, trace, smap);
                })
                .done();
        });
    }
}
export = ConfigLoader;
