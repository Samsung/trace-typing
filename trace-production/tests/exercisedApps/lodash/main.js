var _ = require('lodash');

_.compact([0, 1, false, 2, '', 3]);
_.difference([1, 2, 3, 4, 5], [5, 2, 10]);
var characters = [
    { 'name': 'barney',  'age': 36, 'blocked': false },
    { 'name': 'fred',    'age': 40, 'blocked': true },
    { 'name': 'pebbles', 'age': 1,  'blocked': false }
];

_.findIndex(characters, function(chr) {
    return chr.age < 20;
});
// → 2

// using "_.where" callback shorthand
_.findIndex(characters, { 'age': 36 });
// → 0

// using "_.pluck" callback shorthand
_.findIndex(characters, 'blocked');
var characters = [
    { 'name': 'barney',  'age': 36, 'blocked': true },
    { 'name': 'fred',    'age': 40, 'blocked': false },
    { 'name': 'pebbles', 'age': 1,  'blocked': true }
];

_.findLastIndex(characters, function(chr) {
    return chr.age > 30;
});
// → 1

// using "_.where" callback shorthand
_.findLastIndex(characters, { 'age': 36 });
// → 0

// using "_.pluck" callback shorthand
_.findLastIndex(characters, 'blocked');
_.first([1, 2, 3]);
// → 1

_.first([1, 2, 3], 2);
// → [1, 2]

_.first([1, 2, 3], function(num) {
    return num < 3;
});
// → [1, 2]

var characters = [
    { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
    { 'name': 'fred',    'blocked': false, 'employer': 'slate' },
    { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
];

// using "_.pluck" callback shorthand
_.first(characters, 'blocked');
// → [{ 'name': 'barney', 'blocked': true, 'employer': 'slate' }]

// using "_.where" callback shorthand
_.pluck(_.first(characters, { 'employer': 'slate' }), 'name');
// → ['barney', 'fred']
_.flatten([1, [2], [3, [[4]]]]);
// → [1, 2, 3, 4];

_.flatten([1, [2], [3, [[4]]]], true);
// → [1, 2, 3, [[4]]];

var characters = [
    { 'name': 'barney', 'age': 30, 'pets': ['hoppy'] },
    { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
];

// using "_.pluck" callback shorthand
_.flatten(characters, 'pets');
// → ['hoppy', 'baby puss', 'dino']
_.indexOf([1, 2, 3, 1, 2, 3], 2);
// → 1

_.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
// → 4

_.indexOf([1, 1, 2, 2, 3, 3], 2, true);
// → 2
_.initial([1, 2, 3]);
// → [1, 2]

_.initial([1, 2, 3], 2);
// → [1]

_.initial([1, 2, 3], function(num) {
    return num > 1;
});
// → [1]

var characters = [
    { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
    { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
    { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
];

// using "_.pluck" callback shorthand
_.initial(characters, 'blocked');
// → [{ 'name': 'barney',  'blocked': false, 'employer': 'slate' }]

// using "_.where" callback shorthand
_.pluck(_.initial(characters, { 'employer': 'na' }), 'name');
// → ['barney', 'fred']

_.intersection([1, 2, 3], [5, 2, 1, 4], [2, 1]);
// → [1, 2]

_.last([1, 2, 3]);
// → 3

_.last([1, 2, 3], 2);
// → [2, 3]

_.last([1, 2, 3], function(num) {
    return num > 1;
});
// → [2, 3]

var characters = [
    { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
    { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
    { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
];

// using "_.pluck" callback shorthand
_.pluck(_.last(characters, 'blocked'), 'name');
// → ['fred', 'pebbles']

// using "_.where" callback shorthand
_.last(characters, { 'employer': 'na' });
// → [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]

_.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
// → 4

_.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
// → 1

var array = [1, 2, 3, 1, 2, 3];
_.pull(array, 2, 3);

// → [1, 1]

_.range(4);
// → [0, 1, 2, 3]

_.range(1, 5);
// → [1, 2, 3, 4]

_.range(0, 20, 5);
// → [0, 5, 10, 15]

_.range(0, -4, -1);
// → [0, -1, -2, -3]

_.range(1, 4, 0);
// → [1, 1, 1]

_.range(0);
// → []
var array = [1, 2, 3, 4, 5, 6];
var evens = _.remove(array, function(num) { return num % 2 == 0; });

_.rest([1, 2, 3]);
// → [2, 3]

_.rest([1, 2, 3], 2);
// → [3]

_.rest([1, 2, 3], function(num) {
    return num < 3;
});
// → [3]

var characters = [
    { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
    { 'name': 'fred',    'blocked': false,  'employer': 'slate' },
    { 'name': 'pebbles', 'blocked': true, 'employer': 'na' }
];

// using "_.pluck" callback shorthand
_.pluck(_.rest(characters, 'blocked'), 'name');
// → ['fred', 'pebbles']

// using "_.where" callback shorthand
_.rest(characters, { 'employer': 'slate' });
// → [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
_.sortedIndex([20, 30, 50], 40);
// → 2

// using "_.pluck" callback shorthand
_.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
// → 2

var dict = {
    'wordToNumber': { 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50 }
};

_.sortedIndex(['twenty', 'thirty', 'fifty'], 'forty', function(word) {
    return dict.wordToNumber[word];
});
// → 2

_.sortedIndex(['twenty', 'thirty', 'fifty'], 'forty', function(word) {
    return this.wordToNumber[word];
}, dict);

_.union([1, 2, 3], [5, 2, 1, 4], [2, 1]);

_.uniq([1, 2, 1, 3, 1]);
// → [1, 2, 3]

_.uniq([1, 1, 2, 2, 3], true);
// → [1, 2, 3]

_.uniq(['A', 'b', 'C', 'a', 'B', 'c'], function(letter) { return letter.toLowerCase(); });
// → ['A', 'b', 'C']

_.uniq([1, 2.5, 3, 1.5, 2, 3.5], function(num) { return this.floor(num); }, Math);
// → [1, 2.5, 3]

// using "_.pluck" callback shorthand
_.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');

_.without([1, 2, 1, 0, 3, 1, 4], 0, 1);

_.xor([1, 2, 3], [5, 2, 1, 4]);
// → [3, 5, 4]

_.xor([1, 2, 5], [2, 3, 5], [3, 4, 5]);

_.zip(['fred', 'barney'], [30, 40], [true, false]);

_.zipObject(['fred', 'barney'], [30, 40]);

var wrapped = _([1, 2, 3]);

// returns an unwrapped value
wrapped.reduce(function(sum, num) {
    return sum + num;
});
// → 6

// returns a wrapped value
var squares = wrapped.map(function(num) {
    return num * num;
});

_.isArray(squares);
// → false

_.isArray(squares.value());
// → true

var characters = [
    { 'name': 'barney',  'age': 36 },
    { 'name': 'fred',    'age': 40 },
    { 'name': 'pebbles', 'age': 1 }
];

var youngest = _.chain(characters)
    .sortBy('age')
    .map(function(chr) { return chr.name + ' is ' + chr.age; })
    .first()
    .value();

_([1, 2, 3, 4])
    .tap(function(array) { array.pop(); })
    .reverse()
    .value();

var characters = [
    { 'name': 'barney', 'age': 36 },
    { 'name': 'fred',   'age': 40 }
];

// without explicit chaining
_(characters).first();
// → { 'name': 'barney', 'age': 36 }

// with explicit chaining
_(characters).chain()
    .first()
    .pick('age')
    .value();
_([1, 2, 3]).toString();
_([1, 2, 3]).valueOf();

_.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
_.at(['fred', 'barney', 'pebbles'], 0, 2);
_.contains([1, 2, 3], 1);
// → true

_.contains([1, 2, 3], 1, 2);
// → false

_.contains({ 'name': 'fred', 'age': 40 }, 'fred');
// → true

_.contains('pebbles', 'eb');
_.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
// → { '4': 1, '6': 2 }

_.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
// → { '4': 1, '6': 2 }

_.countBy(['one', 'two', 'three'], 'length');

// ADD MORE CUSTOM USAGE WITH https://lodash.com/docs
