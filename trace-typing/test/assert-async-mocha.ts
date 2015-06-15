///<reference path="../typings/node/node.d.ts"/>
import assertOrig = require("assert");

/**
 * Wrapped asserts to support async calls & mocha
 * (no better solution on the internet???!)
 *
 * (expand as needed)
 */
export function deepEqual<T>(actual:T, expected:T, done:Function, message?:string, multipleAsserts?:boolean) {
    test(function () {
        assertOrig.deepEqual(actual, expected, message);
    }, done, multipleAsserts);
}
export function equal<T>(actual:T, expected:T, done:Function, message?:string, multipleAsserts?:boolean) {
    test(function () {
        assertOrig.equal(actual, expected, message);
    }, done, multipleAsserts);
}
export function assert(value:any, done:Function, message?:string, multipleAsserts?:boolean) {
    test(function () {
        assertOrig(value, message)
    }, done, multipleAsserts);
}

function test(f:Function, done:Function, multipleAsserts:boolean) {
    try {
        f();
        if (!multipleAsserts)
            done();
    } catch (e) {
        done(e);
        throw e;
    }

}
