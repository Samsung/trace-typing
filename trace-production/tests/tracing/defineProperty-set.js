var o = {};
Object.defineProperty(o, 'p', {
    set: function (v) {
        this._p = v;
    }
});
o.p = 42;
o._p;