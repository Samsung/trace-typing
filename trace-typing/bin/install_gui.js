#!/usr/bin/env node

/**
 * Installs the dependencies for the GUI
 * TODO moved GUI to sub-project?
 */

var fs = require("fs");
var cp = require("child_process");

var target = __dirname + "/../src/gui";

console.log("Installing dependencies for GUI: %s", target);
cp.execSync("npm install", {cwd: target});
