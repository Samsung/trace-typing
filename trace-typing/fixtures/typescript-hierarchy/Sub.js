var Super = require('./Super')
var __extends = function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() {
            this.constructor = d;
        }

        __.prototype = b.prototype;
        d.prototype = new __();
    };
var Sub = (function (_super) {
    __extends(Sub, _super);
    function Sub() {
        _super.apply(this, arguments);
    }

    Sub.prototype.subMethod = function () {
        return 42;
    };
    return Sub;
})(Super);
module.exports = Sub;