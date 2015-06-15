function f() {
    try {
        fail.fail.fail
    } catch (e) {

    }
}
f()

function g() {
    (function () {
        try {
            fail.fail.fail
        } catch (e) {

        }
    })();
}
g()

function h() {
    try {
        new undefined
    } catch (e) {

    }
}
h()