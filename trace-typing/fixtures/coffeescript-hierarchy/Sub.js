var Super = require('./Super')
var Sub,
    extend = function (child, parent) {
        for (var key in parent) {
            if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
            this.constructor = child;
        }

        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
    },
    hasProp = {}.hasOwnProperty;

Sub = (function (superClass) {
    extend(Sub, superClass);

    function Sub() {
        return Sub.__super__.constructor.apply(this, arguments);
    }

    Sub.prototype.subMethod = function () {
        return 42;
    };

    return Sub;

})(Super);
module.exports = Sub;