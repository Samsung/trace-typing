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
var fs = require('fs');
var path = require('path');

var rootDir = path.resolve(__dirname + "/..");
var defaultConfigLocation = rootDir + "/config.default.js";
var loadedConfig = undefined;
exports.load = function () {
    if (loadedConfig !== undefined) {
        return loadedConfig;
    }
    var defaultConfig = require(defaultConfigLocation).config;

    var configs = [];

    configs.push(defaultConfig);

    var configLocation = rootDir + "/config.js";
    if (fs.existsSync(configLocation)) {
        configs.push(require(configLocation).config);
    }

    var combinedConfig = {};

    for (var i in configs) {
        var config = configs[i];
        for (var p in config) {
            combinedConfig[p] = config[p];
        }
    }
    loadedConfig = combinedConfig;
    return combinedConfig;
};
