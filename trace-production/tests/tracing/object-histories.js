(function () {
    var empty = {};
    var single = {a: 'a'};
    var multi = {a: 'a', '0': 0};

    var expanding = {};
    expanding.a = 'a';
    expanding.b = 'b';
    expanding.c = 'c';

    var changing = {};
    changing.p = 'foo';
    changing.p = 'bar';

    var changingTypes = {};
    changingTypes.p = 'foo';
    changingTypes.p = 42;
})();
