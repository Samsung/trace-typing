/**
 * Example initialization file
 */
$(function () {
    var table = {
        headers: ['foo', 'bar', 'baz'],
        rows: [
            ['f', 'b', 'b'],
            ['a', 'b', 'c'],
            [1, 2, 3]
        ]
    };
    showTable(table);
});
