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


var DEBUG = true;

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
        'failingCall'
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
        "../exercisedApps/underscore"
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
        //'/exercisedApps',
        '/bower', // Performance issue: > 5 minutes. Lots of time spent in instrumentation
        '/browserify', // Jalangi issue#18: "TypeError: Function.prototype.apply was called on undefined, which is a undefined and not a function"
        '/cheerio', // syntactic getter/setter
        '/cordova', // Performance issue: > 5 minutes. Lots of time spent in instrumentation
        '/commander', // uses __proto__ assignment
        '/express', // performs unobserved property write!!
        '/forever', // Jalangi issue#18: "TypeError: Function.prototype.apply was called on undefined, which is a undefined and not a function"
        '/grunt', // performs unobserved property write!!
        '/gulp', // performs unobserved property write!!
        '/karma', // Performance issue: > 5 minutes. Lots of time spent in instrumentation
        '/less', // Analysis bug: Causes "TypeError: Cannot read property 'css' of undefined", but empty Jalangi analysis is fine...
        '/pm2', // syntactic getter/setter
        '/escodegen', // "Fatal error in ../deps/v8/src/handles.h, line 48" !!!!!!!!!!!!!!!
        'getter',
        'setter',
        'eval',
        'bind_bug', // uses .callee
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
                    runner.run(target, exportFile, DEBUG).then(function () {
                        done();
                    }).done();
                });
            });
        })
    })
});