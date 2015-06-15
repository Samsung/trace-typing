function f() {
    this;
}


var o = {
    m: function () {
        this;
    }
}

f();

o.m();