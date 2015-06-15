globalVar = 'global 1';
var scriptLocal;
scriptLocal = 'scriptLocal 1';
function f(param){
    param = 'param';
    globalVar = 'global 2';
    scriptLocal = 'scriptLocal 2'
    var local;
    local = 'local';
}
f();