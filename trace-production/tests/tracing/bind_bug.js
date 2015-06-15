function f(callee){
    console.log(arguments.callee === callee);
}
var g = f.bind();
f(f);
g(g);