function f() {
    var source = 'foo';
    try {
        new Function("42fail");
    } catch (e) {
        e.source = source;
    }
}