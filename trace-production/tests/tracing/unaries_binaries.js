// all unaries
var a = +42,
    b = -42,
    c = ~42,
    d = !42,
    e = typeof true;

// binaries (some)
var f = 42 - 42,
    g = 42 >>> 42,
    h = "foo" + 42,
    j = "foo" + "bar",
    k = 24 <= 42,
    l = {} instanceof Object,
    m = 'x' in {},
    n = delete {}.p;

// && || are not binaries in Jalangi!