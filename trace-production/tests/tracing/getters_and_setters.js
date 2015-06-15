var o = {
    get f(){return 'f'},
    set f(v){return v}
}
var v;

v = o.f;
o.f = v;
