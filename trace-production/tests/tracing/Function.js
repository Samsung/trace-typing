var f = new Function();
var g = new Function("return 42;");
var h = new Function("x", "return x;")

var vf = f();
var vg = g();
var vh = h();

try {
    new Function('p1')();
} catch (e) {

}

try {
    new Function('p1', 'p2')();
} catch (e) {

}

try {
    new Function('p1', 'p2', 'p3')();
} catch (e) {

}