toString.apply('x');
toString.apply('x', ['y']);
toString.apply(undefined);
toString.apply();

function f(x, y){
    return this + x + y;
}
Array.prototype.push.apply([], [])
Array.prototype.push.apply([], [3])
Array.prototype.push.apply([], [3, 5])
f.apply({}, []);
f.apply({}, [5]);
f.apply({}, [5, 6]);
f.apply(undefined, []);
f.apply(undefined, [5, 6]);

var a = [1, 2, 3];
Array.prototype.push.apply(a, [4]);
Array.prototype.push.apply(a, [4, 5]);
Array.prototype.pop.apply(a, []);

function g() {
}
g.apply(undefined, [undefined, undefined]);