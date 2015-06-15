var path = require('path');
var rootDir = path.resolve(__dirname + "/../out");

var config = {
    /**
     * The directory trace files are stored in by trace-producer (only relevant for smoke-testing traces produced by trace-producer testing).
     */
    tracesDirectory: rootDir + "/traces",

    /**
     * The directory to store files with experiment results in.
     */
    experimentResultDirectory: rootDir + "/results"
};

exports.config = config;