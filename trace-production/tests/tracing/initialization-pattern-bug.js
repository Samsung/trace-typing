/**
 * lodash.use.js fails on this initialization pattern...
 * function slice(array, start, end) {
 *  start  || (start = 0);
 *  ...
 * }
 */
function g() {
    function f(x) {
        x || (x = 0);
    }

    return f(0);
}
g();