function f(o){
    if (typeof o !== 'undefined'){
        o.p;
    }
}
f({})
f(undefined)