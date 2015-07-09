function f(a) { a.p = 7; }
function g(b) {
    b.q = b.q + "!";
    return b;
}
var x = {};
x = {p: 3};
var y = {p: 4, q: " hi "};
var z = {q: " bye ", r: false};
f(x);
f(y);
g(y);
var w = g(z);
w.r = true;