var Super = (function () {
    function Super() {
    }

    Super.prototype.superMethod = function () {
        return 'foo';
    };
    return Super;
})();
module.exports = Super;