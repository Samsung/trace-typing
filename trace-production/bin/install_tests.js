#!/usr/bin/env node

/**
 * Installs the dependencies for some tests.
 */

var fs = require("fs");
var cp = require("child_process");

var root = __dirname + "/../tests/exercisedApps";

var targets = fs.readdirSync(root);
targets.forEach(function (targetName, i) {
    var target = root + "/" + targetName;
    console.log("Installing dependencies for test case: %s", target);
    if (fs.statSync(target).isDirectory()) {
        cp.execSync("npm install", {cwd: target});
    }
});