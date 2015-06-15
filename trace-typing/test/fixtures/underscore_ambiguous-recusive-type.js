(function () {
    var _ = function () {
    };
    _.bind = function () {
    };
    _.partial = function () {
        Array.prototype.slice.call(arguments);
    };
    _.partial();
}.call());