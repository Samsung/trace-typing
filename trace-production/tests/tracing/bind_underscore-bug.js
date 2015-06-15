(function () {
    var ArrayProto = Array.prototype, FuncProto = Function.prototype;
    var slice = ArrayProto.slice;
    var nativeBind = FuncProto.bind;
    var _ = function () {
    };
    exports._ = _;
    _.bind = function () {
        return nativeBind.apply(func);
    };
}.call());
var _ = exports._;
var func = function () {
};
func = _.bind();
func();