var path = require("path");
var runner = require("./Tracing_runner");

function handleError(e) {
    console.error("Something went wrong:\n" + e);
    process.exit(1);
}

try {
    var target = process.argv[2];
    console.log(target);
    runner.run({main: target}, undefined, true).then(function(){
        console.log("CLI done");
    });
} catch (e) {
    handleError(e);
}
