(function () {
    var ArrayProto = Array.prototype;
    var slice = ArrayProto.slice;
    var _ = function () {
    };
    exports._ = _;
    _.delay = function () {
        return setTimeout(function () {
        });
    };
    _.defer = function () {
        return _.delay.apply(_, [func].concat());
    };
    _.extend = function (obj) {
        for (var i = 1, length = arguments.length; i < length; i++) {
            source = arguments[i];
            for (prop in source) {
                if (hasOwnProperty.call(source, prop)) {
                    obj[prop] = source[prop];
                }
            }
        }
    };
    _.isObject = function (obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };
}.call(this));
var _ = exports._;
var func = function (greeting) {
    return greeting + ': ' + this.name;
};
func = _.bind(func, { name: 'moe' }, 'hi');
func();
_.defer(function () {
    alert('deferred');
});
_.extend({ name: 'moe' }, { age: 50 });