var a;

a = toString(); // native/uninstrumented
a = toString(42, 'foo'); // native/uninstrumented
a = '*base*'.toString('*arg1*', '*arg2*'); // native/uninstrumented

function f() {
}
a = f(); // enough: zero
a = f(87); // too many

function g(p) {
}
a = g(); // to few
a = g(99); // enough: one

function h(p1, p2) {
}
a = h('foo', 'bar'); // enough: two

var b = {
    p: function () {
    }
};
a = b.p();
a = b.p(42);
a = b['p']();

function i() {
    return 42;
}
a = i();

function j(p) {
    return p;
}
a = j('foo');

function k(p) {
    return j(p);
}
a = k('bar');

function l(p) {
    return 42342;
}
a = new l();

a = new l(42);

a = new String();

function m() {
    return arguments;
}
a = m();

function n() {
    return this;
}
a = n();

function o(){
    return toString;
}
a = o();

function p(){
    var toString = "foo";
    (function(){return toString;})();
}
a = p();