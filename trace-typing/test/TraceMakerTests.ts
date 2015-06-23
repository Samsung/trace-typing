///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../src/types.d.ts"/>

import assert = require("./assert-async-mocha");
import path = require("path");
import maker = require("../src/TraceMaker")
import importer = require("../src/TraceImporter")
var fixtures = path.resolve("fixtures");

describe("TraceMaker", function () {
    var aproximatePreambleSize = 280;
    describe("getTraceFromSource", function () {
        it("should work on empty source", function (done) {
            maker.getTraceFromSource("", function (err: any, trace:Trace) {
                if(err){
                    done(err);
                    return;
                }
                assert.assert(trace.statements.length > aproximatePreambleSize, done);
            });
        });
        it("should work on non-empty source", function (done) {
            maker.getTraceFromSource("var a = 2 + 42;", function (err: any, trace:Trace) {
                if(err){
                    done(err);
                    return;
                }
                assert.assert(trace.statements.length > aproximatePreambleSize, done);
            });
        });
        it("should work on non-empty source 2", function (done) {
            maker.getTraceFromSource("var b = 2 + 42;", function (err: any, trace:Trace) {
                if(err){
                    done(err);
                    return;
                }
                assert.assert(trace.statements.length > aproximatePreambleSize, done);
            });
        });
    });
    describe("getTraceFromSourceFile", function () {
        it("should work on empty source", function (done) {
            maker.getTraceFromSourceFile(fixtures + "/empty.js", function (err:any, trace:Trace) {
                if (err) {
                    done(err);
                    return;
                }
                assert.assert(trace.statements.length > aproximatePreambleSize,  done);
            });
        });
        it("should work on non-empty source", function (done) {
            var sourceFile = fixtures + "/non-empty.js";
            maker.getTraceFromSourceFile(sourceFile, function (err:any, trace:Trace) {
                if (err) {
                    done(err);
                    return;
                }
                assert.assert(trace.statements.length > aproximatePreambleSize, done);
            });
        });
    });
    describe("getTraceFromDir", function () {
        it("should work on multiple files", function (done) {
            var dir = fixtures + "/multiple-files-1";
            maker.getTraceFromDir({dir: dir, main: dir + "/main.js"}, function (err:any, trace:Trace) {
                if (err) {
                    done(err);
                    return;
                }
                assert.assert(trace.statements.length > aproximatePreambleSize, done);
            });
        });
    });
});