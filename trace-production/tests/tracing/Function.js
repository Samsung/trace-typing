var f = new Function();
var g = new Function("return 42;");
var h = new Function("x", "return x;")

var vf = f();
var vg = g();
var vh = h();