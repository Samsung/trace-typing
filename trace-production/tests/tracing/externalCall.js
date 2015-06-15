var o = {p: 42};
var a1 = [o];
function f(o) {
    return o.p;
};
var a2 = a1.map(f)