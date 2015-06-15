var TO_STRING_ORIG = Object.prototype.toString;
Object.prototype.toString = function() { return "fizz"; }
var x = {};
console.log(x.toString());
Object.prototype.toString = TO_STRING_ORIG;