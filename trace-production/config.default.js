var path = require('path');
var rootDir = path.resolve(__dirname + "/../out");

var config = {
    /**
     * The directory to store trace files in.
     */
    tracesDirectory: rootDir + "/traces",

    /**
     * The directory to store instrumented files in.
     */
    instrumentationDirectory: rootDir + "/instrumentations"
};

exports.config = config;