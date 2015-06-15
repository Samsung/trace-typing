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
var path = require("path");
var fs = require("fs");

var Interface = {};

var jalangiDirectory = path.resolve(__dirname + '/../node_modules/jalangi2');
Interface.headers = require(jalangiDirectory + '/src/js/headers');
global.acorn = require('acorn');
global.esotope = require('esotope');
Interface.headers.headerSources.forEach(function (src) {
    require(jalangiDirectory + '/' + src);
});

// TODO use the new Jalangi API for instrumenting files...
function instrumentFile(fileName, args, injectASTInfo) {
    var FILESUFFIX1 = "_jalangi_";

    function makeInstCodeFileName(name) {
        return name.replace(/.js$/, FILESUFFIX1 + ".js").replace(/.html$/, FILESUFFIX1 + ".html");
    }

    function makeSMapFileName(name) {
        return name.replace(/.js$/, ".json");
    }

    var code = fs.readFileSync(fileName, 'utf8');
    var instFilename = args.instScriptFile || makeInstCodeFileName(fileName);
    var instCodeAndData = Interface.instrumentCode(
        code,
        {
            isEval: false,
            origCodeFileName: fileName,
            instCodeFileName: instFilename,
            inlineSourceMap: true, // !!args.inlineIID,
            inlineSource: false // !!args.inlineSource
        });
    fs.writeFileSync(makeSMapFileName(instFilename), instCodeAndData.sourceMapString, "utf8");
    instCodeAndData.code = typeof injectASTInfo === 'function' ? injectASTInfo(instCodeAndData) : instCodeAndData.code;
    fs.writeFileSync(instFilename, instCodeAndData.code, "utf8");
    instCodeAndData.outputFile = instFilename;
    return instCodeAndData;
}

Interface.ChainedAnalyses = path.resolve(jalangiDirectory + "/src/js/sample_analyses/ChainedAnalyses.js");
Interface.instrumentCode = (require(jalangiDirectory + "/src/js/instrument/esnstrument"), function (code, options) {
    options.code = code;
    return global.J$.instrumentCode(options)
});
Interface.astUtil = (require(jalangiDirectory + "/src/js/instrument/astUtil"), global.J$.astUtil);
Interface.instrumentFile = instrumentFile;

module.exports = Interface
