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
UNITTESTING = true;
// mock Jalangi environment
global.J$ = global.J$ || {};
global.J$.initParams = global.J$.initParams || {};
global.J$.initParams.debug = true;
var assert = require("assert"),
    TraceBuilder = require("../src/TraceBuilder.js").TraceBuilder,
    checkTraceConsistency = require("../src/TraceConsistencyChecker").checkTraceConsistency;

var trace = []
var traceBuilder = new TraceBuilder(function (e) {
    trace.push(e)
});
describe('traceBuilder', function () {
    it('can create all elements', function (done) {
        var dummyTmp1 = 'tmp42';
        var dummyTmp2 = 'tmp87';
        var dummyTmp3 = 'tmp99';
        var dummyTmp4 = 'tmp01';
        var dummyTmp5 = 'tmp66';

        traceBuilder.makePrimitiveStatement('foo', dummyTmp1);

        // define all temporaries to satisfy consistency checks
        traceBuilder.makeMoveStatement(dummyTmp2, dummyTmp1);
        traceBuilder.makeMoveStatement(dummyTmp3, dummyTmp1);
        traceBuilder.makeMoveStatement(dummyTmp4, dummyTmp1);
        traceBuilder.makeMoveStatement(dummyTmp5, dummyTmp1);

        traceBuilder.makeFieldWriteStatement(dummyTmp1, 'p', dummyTmp2, true);
        traceBuilder.makeDeleteStatement(dummyTmp1, 'p');
        traceBuilder.makeInfoStatement("message");
        traceBuilder.makeFieldReadStatement(dummyTmp1, 'p', dummyTmp2);
        traceBuilder.makeNewStatement(dummyTmp1, dummyTmp2);
        checkTraceConsistency(trace);
        assert.equal(trace.length, 10);
        // ensure that the toString succeeds and is meaningful
        assert(trace.join(",").length > 100);
        done();
    });
});
UNITTESTING = false;