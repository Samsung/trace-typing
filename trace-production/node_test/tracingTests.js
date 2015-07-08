/*
 * Copyright 2014 Samsung Information Systems America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Author: Esben Andreasen

var path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    runner = require("../src/Tracing_runner");


var DEBUG = false;

var usesRelativeRequire = new Set();
usesRelativeRequire.add("array_length");
usesRelativeRequire.add("exception");
usesRelativeRequire.add("object_tracking");
usesRelativeRequire.add("symbolic");
usesRelativeRequire.add("c");
usesRelativeRequire.add("instanceof");

var allTests = {
    'manually normalized tests': [
        'literals'
    ],
    'emptying value-stack tests': [
        'assignments',
        'unaries_binaries',
        "calls",
        'conditionals',
        'comma'
    ],
    'non-emptying value-stack tests': [
        'switch',
        'unused-expressions'
    ],
    'custom tests': [
        'function-declaration-return',
        'eval',
        'exceptions',
        'getters_and_setters', // with getters and setters being unsupported, some call-from-external will appear
        'coercion',
        'var-param-ambiguity',
        'unary-coercions',
        'void',
        'for-in',
        'object-histories',
        'initialization-pattern-bug',
        'declaration-scopes',
        'scoping',
        'trace-example-1',
        'trace-example-2',
        'trace-example-3',
        'trace-example-4',
        'returnValue',
        'this',
        'for',
        'commas',
        'comma2',
        'dynamicPropertyNames',
        'plusplus',
        'double-declarations',
        'dummy1',
        'dummy2',
        'dummy3',
        'function-call-property-access',
        'module_filename',
        'module',
        'array_sort',
        'array_concat',
        'array_push',
        'externalCall',
        'variables',
        'apply',
        'call',
        'call_underscore-bug',
        'call_underscore-bug.minimised',
        'call_underscore-bug-2',
        'call_underscore-bug-2.minimised',
        'bind_underscore-bug',
        'bind_underscore-bug.minimised',
        'bind_underscore-bug-2',
        'bind_underscore-bug-2.minimised',
        'bind_bug',
        'try-catch',
        'dpa_method_calls',
        'apply-concat-bug',
        // 'xxx.minimised',
        // Jalangi issue#19:
        'browserify-template',
        'browserify-template-bug-minimised',
        'functionNamingScopes',
        // / Jalangi issue#19:
        // 'defineProperty-set',
        // 'defineProperty-get',
        'functionDeclaration',
        'declarations',
        'functionDeclarations',
        'oneShotClosure',
        'SJS-map-object-literals',
        'trivialAssignment',
        'typeofConstant',
        'try-catch-var',
        'empty',
        'Function',
        'failingCall',
        'with'
    ],
    'multiple files': [
        "multi1"
    ],
    'unit tests': String(fs.readFileSync("tests/unitTestsFromJalangi/unitTests.txt")).split('\n')
        .filter(function (e) {
            return e.indexOf(' ') === -1 && !usesRelativeRequire.has(e);
        })
        .map(function (e) {
            return "../unitTestsFromJalangi/" + e;
        }),
    //'sunspider': String(fs.readFileSync("tests/sunspider1/LIST")).split('\n')
    //    .filter(function (e) {
    //        return e.indexOf(' ') === -1 && !usesRelativeRequire.has(e);
    //    })
    //    .map(function (e) {
    //        return "../sunspider1/" + e;
    //    }),
    'big tests': [],
    'applications:': [],
    'multi-file applications': [
        "../exercisedApps/bower",
        "../exercisedApps/browserify",
        "../exercisedApps/cheerio",
        "../exercisedApps/coffee-script",
        "../exercisedApps/commander",
        "../exercisedApps/cordova",
        "../exercisedApps/escodegen",
        "../exercisedApps/express",
        "../exercisedApps/forever",
        "../exercisedApps/grunt",
        "../exercisedApps/gulp",
        "../exercisedApps/karma",
        "../exercisedApps/lazy.js",
        "../exercisedApps/less",
        "../exercisedApps/lodash",
        "../exercisedApps/minimist",
        "../exercisedApps/optparse",
        "../exercisedApps/pm2",
        "../exercisedApps/underscore",

        // "new" benchmarks
        "../exercisedApps/jade",
        "../exercisedApps/validator",
        "../exercisedApps/jshint",
        "../exercisedApps/uglifyjs",
        "../exercisedApps/xml2js",
        "../exercisedApps/ejs",
        "../exercisedApps/jscs",
        "../exercisedApps/handlebars",
        "../exercisedApps/joi",
        "../exercisedApps/qs",
        "../exercisedApps/typescript",
        "../exercisedApps/babel",
        "../exercisedApps/esprima"
    ]
}

function ignore(test) {
    var explicitIgnores = [
        '../unitTestsFromJalangi/instrument-test', // uses eval
        '../unitTestsFromJalangi/issue78', // uses eval
        '../unitTestsFromJalangi/issue78b', // uses eval
        '../unitTestsFromJalangi/async_events',
        '../unitTestsFromJalangi/monkeypatch'
    ];
    var forbiddenSubstrings = [
        // '/exercisedApps',

        // need to be run with the node-jalangi script (most likely),
        // (tests are full of warnings about instrumentation failures due to the 'get-all-.js-files' strategy applied by jalangi)
        '/bower', // Performance issue: > 5 minutes. Lots of time spent in instrumentation.
        '/karma', // Performance issue: > 5 minutes. Lots of time spent in instrumentation.
        '/cordova', // Performance issue: > 5 minutes. Lots of time spent in instrumentation.
        '/browserify', // Performance issue: > 5 minutes. Lots of time spent in instrumentation.
        '/grunt', // 'popping of empty shadow stack' (after a bunch of evals)

        // need support for getters & setter literals
        '/pm2', // uses getter/setter

        // need support for getters & setter definitions
        '/cheerio', // uses getter/setter
        '/express', // uses getter/setter
        '/forever', // uses getter/setter
        '/gulp', // uses getter/setter
        '/jade',
        '/jshint',
        '/uglifyjs',
        '/jscs',
        '/babel',

        'getter',
        'setter',

        // need replayer improvements
        '/commander', // uses __proto__ assignment
        'less', // uses nasty polyfill hacks (see exercisedApps/less/node_modules/less/node_modules/graceful-fs/fs.js), fails during replay
        'ejs', // uses `with`
        'bind_bug', // uses .callee
        '/validator', // explicitly ignored (unknown reason, need to check up)

        // bizare .exports usage?
        '/joi',

        // bizarre non-stack discipline(!?) : TraceCollectionController never calls calls `stop` even though the process exits successfully..
        '/handlebars',

        // weird trace: uncoerced Number property access, should clearly be an array...
        '/coffee-script',

        '_jalangi_',
        'sunspider' // only for performance testing
    ];
    for (var i = 0; i < forbiddenSubstrings.length; i++) {
        if (test.toLowerCase().indexOf(forbiddenSubstrings[i].toLowerCase()) !== -1) {
            return false;
        }
    }

    return explicitIgnores.indexOf(test) === -1;
}

function newFileName(dir, prefix, extension) {
    var suggestion = dir + "/" + prefix + "-" + (+new Date()).toString(36) + extension;
    if (fs.existsSync(suggestion)) {
        return newFileName(dir, extension);
    }
    return suggestion;
}

var traceExportDirectory = require("../src/ConfigLoader").load().tracesDirectory
if (!fs.existsSync(traceExportDirectory)) {
    mkdirp.sync(traceExportDirectory);
}
var nonDebugSubstrings = [
    // large cases that should not be slowed down by the debug-flag
    '/escodegen'
];
function shouldDebug(main){
    if(!DEBUG){
        return false;
    }
    for(var i = 0; i < nonDebugSubstrings.length; i++){
        if(main.indexOf(nonDebugSubstrings[i])){
            return false;
        }
    }
    return true;
}
describe('tracing', function () {
    this.timeout(15 * 60 * 1000);
    Object.getOwnPropertyNames(allTests).forEach(function (suiteName) {
        describe('should handle "' + suiteName + '"', function (done) {
            var tests = allTests[suiteName].filter(ignore);
            tests.forEach(function (test) {
                it('in particular: "' + test + '"', function (done) {
                    var exportFile = path.resolve(newFileName(traceExportDirectory, path.basename(test), ".trace"));
                    var target = {};
                    if (suiteName === "multiple files" || suiteName === "multi-file applications") {
                        var dir = path.resolve("tests/tracing/" + test);
                        target.main = dir + '/main.js';
                        target.dir = dir;
                    } else {
                        target.main = path.resolve("tests/tracing/" + test + ".js");
                    }
                    runner.run(target, exportFile, shouldDebug(target.main)).then(function () {
                        done();
                    }).done();
                });
            });
        })
    })
});