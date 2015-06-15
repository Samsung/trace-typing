///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../src/types.d.ts"/>
import path = require("path");
import assert = require("./assert-async-mocha");
import TraceImporter = require("../src/TraceImporter");

describe("TraceImporter", function () {
    this.timeout(60 * 1000);
    describe("Should not crash on any traces", function () {
        var traceImporter:TraceImporter.TraceImporter = new TraceImporter.TraceImporter();
        traceImporter.getAllTraceFiles().forEach(function (file:string) {
                if (file.indexOf("JSON_nan_bug.js") !== -1) {
                    return; // ignore
                }
                it("... in particular: " + path.basename(file), function (done) {
                    traceImporter.import(file, function (err:any, imported:TraceImport) {
                        assert.assert(imported.date, done, undefined, true);
                        assert.assert(imported.trace, done, undefined, true);
                        assert.assert(imported.trace.statements.length > 0, done, undefined, true);
                        done(err);
                    });
                })
            }
        );
    });
});
