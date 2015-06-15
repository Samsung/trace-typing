toString.call('x');
toString.call('x', 'y');
toString.call(undefined);
toString.call();

function f(x, y){
    return this + x + y;
}
Array.prototype.push.call([])
Array.prototype.push.call([], 3)
Array.prototype.push.call([], 3, 5)
f.call({});
f.call({}, 5);
f.call({}, 5, 6);
f.call(undefined);
f.call(undefined, 5, 6);

var a = [1, 2, 3];
Array.prototype.push.call(a, 4);
Array.prototype.push.call(a, 5);
Array.prototype.pop.call(a);


function g() {
}
g.call(undefined, undefined, undefined);