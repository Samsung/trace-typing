var o = {_p: 42};
Object.defineProperty(o, 'p', {
    get: function (v) {
        return this._p;
    }
});
o.p;