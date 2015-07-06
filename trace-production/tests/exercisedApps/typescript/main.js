var ts = require('typescript');
var source = "let x: string  = 'string'";
var result = ts.transpile(source, {module: ts.ModuleKind.CommonJS});
