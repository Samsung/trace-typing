var flatten = function (input) {
    for (var i = 0; i < input.length; i++) {
        var value = input[i];
        flatten(value);
    }
};

flatten([[2], [3, [[4]]]]);

