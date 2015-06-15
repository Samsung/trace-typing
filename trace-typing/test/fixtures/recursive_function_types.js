function main() {
    var o = {};
    Object.keys(o);

    function f() {
        return Array();
    }

    function g() {
        return f();
    }

    function h() {
        return o;
    }

    o.g = g;
    o.h = h;
    h();
    h(o);
    f(o.g)
    f(o.h)
    o.g();
    o.g([1]);
}
main();