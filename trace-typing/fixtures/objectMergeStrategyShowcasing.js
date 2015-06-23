(function UnnestedObjects() {
    (function noMerge() {
        function test(o) {
            o.p;
        }

        var o1 = {x: 42};
        test(o1);
    }());

    (function mergeSamePropertyValue() {
        function test(o) {
            o.p;
        }

        var o1 = {x: 42};
        var o2 = {x: 42};
        test(o1);
        test(o2);
    }());


    (function mergeDifferentPropertyValues() {
        function test(o) {
            o.p;
        }

        var o1 = {x: 42};
        var o2 = {x: 'foo'};
        test(o1);
        test(o2);
    }());

    (function mergeDifferentPropertyNames() {
        function test(o) {
            o.p;
        }

        var o1 = {x: 42};
        var o2 = {y: 42};
        test(o1);
        test(o2);
    }());

    (function mergeDifferentPropertyValuesAndNames() {
        function test(o) {
            o.p;
        }

        var o1 = {x: 42, y: 'foo'};
        var o2 = {x: 42, y: 42, z: 42};
        test(o1);
        test(o2);
    }());
}());

(function NestedObjects() {
    (function mergeSamePropertyValue() {
        function test(o) {
            o.p;
        }

        var o1 = {x: {p: 42}};
        var o2 = {x: {p: 42}};
        test(o1);
        test(o2);
    }());

    (function mergeDifferentPropertyValues() {
        function test(o) {
            o.p;
        }

        var o1 = {x: {p: 42}};
        var o2 = {x: {p: 'foo'}};
        test(o1);
        test(o2);
    }());

    (function mergeDifferentPropertyNames() {
        function test(o) {
            o.p;
        }

        var o1 = {x: {p: 42}};
        var o2 = {y: {p: 'foo'}};
        test(o1);
        test(o2);
    }());

    (function mergeDifferentPropertyValuesAndNames() {
        function test(o) {
            o.p;
        }

        var o1 = {x: 42, y: {p: 'foo'}};
        var o2 = {x: {p: 42}, y: {p: 42}, z: {p: 42}};
        test(o1);
        test(o2);
    }());
}());