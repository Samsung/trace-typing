var CoffeeScript = require('coffee-script');
// CoffeeScript.compile() will run the compiler on a string representing source code

// Here's an escaped coffeescript source file: the coffee-resque implementation
// https://github.com/technoweenie/coffee-resque/blob/master/src/index.coffee
var src = "" +
    "# Contributed by Jason Huggins\n" +
    "\n" +
    "http = require 'http'\n" +
    "\n" +
    "server = http.createServer (req, res) ->\n" +
    "  res.writeHeader 200, 'Content-Type': 'text/plain'\n" +
    "  res.write 'Hello, World!'\n" +
    "  res.end()\n" +
    "\n" +
    "server.listen PORT = 3000\n" +
    "\n" +
    "console.log \"Server running at http://localhost:#{PORT}/\"\n" +
    "";

var js = CoffeeScript.compile(src);
console.log(js);
