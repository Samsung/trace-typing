var underscore = require('underscore');
var _ = underscore;

// BEGIN CUSTOM USAGE
function alert(){}
_.each([1, 2, 3], alert);
_.each({one: 1, two: 2, three: 3}, alert);
_.map([1, 2, 3], function(num){ return num * 3; });
_.map({one: 1, two: 2, three: 3}, function(num, key){ return num * 3; });
var sum = _.reduce([1, 2, 3], function(memo, num){ return memo + num; }, 0);
var list = [[0, 1], [2, 3], [4, 5]];
var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
var even = _.find([1, 2, 3, 4, 5, 6], function(num){ return num % 2 == 0; });
var evens = _.filter([1, 2, 3, 4, 5, 6], function(num){ return num % 2 == 0; });
var odds = _.reject([1, 2, 3, 4, 5, 6], function(num){ return num % 2 == 0; });
_.every([true, 1, null, 'yes'], _.identity);
_.some([null, 0, 'yes', false]);
_.contains([1, 2, 3], 3);
_.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
_.pluck(stooges, 'name');
var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
_.max(stooges, function(stooge){ return stooge.age; });
var numbers = [10, 5, 100, 2, 1000];
_.min(numbers);
_.sortBy([1, 2, 3, 4, 5, 6], function(num){ return Math.sin(num); });
_.groupBy([1.3, 2.1, 2.4], function(num){ return Math.floor(num); });
_.groupBy(['one', 'two', 'three'], 'length');
var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
_.indexBy(stooges, 'age');
_.countBy([1, 2, 3, 4, 5], function(num) {
    return num % 2 == 0 ? 'even': 'odd';
});
_.shuffle([1, 2, 3, 4, 5, 6]);
_.sample([1, 2, 3, 4, 5, 6]);
_.sample([1, 2, 3, 4, 5, 6], 3);
(function(){ return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
_.size({one: 1, two: 2, three: 3});
_.first([5, 4, 3, 2, 1]);
_.initial([5, 4, 3, 2, 1]);
_.last([5, 4, 3, 2, 1]);
_.rest([5, 4, 3, 2, 1]);
_.compact([0, 1, false, 2, '', 3]);
_.flatten([1, [2], [3, [[4]]]]);
_.flatten([1, [2], [3, [[4]]]], true);
_.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
_.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
_.intersection([1, 2, 3], [101, 2, 1, 10], [2, 1]);
_.difference([1, 2, 3, 4, 5], [5, 2, 10]);
_.uniq([1, 2, 1, 3, 1, 4]);
_.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
_.object(['moe', 'larry', 'curly'], [30, 40, 50]);
_.object([['moe', 30], ['larry', 40], ['curly', 50]]);
_.indexOf([1, 2, 3], 2);
_.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
_.sortedIndex([10, 20, 30, 40, 50], 35);
_.range(10);
_.range(1, 11);
_.range(0, 30, 5);
_.range(0, -10, -1);
_.range(0);
var func = function(greeting){ return greeting + ': ' + this.name };
func = _.bind(func, {name: 'moe'}, 'hi');
func();
var add = function(a, b) { return a + b; };
add5 = _.partial(add, 5);
add5(10);
var fibonacci = _.memoize(function(n) {
    return n < 2 ? n: fibonacci(n - 1) + fibonacci(n - 2);
});
_.defer(function(){ alert('deferred'); });
_.keys({one: 1, two: 2, three: 3});
_.values({one: 1, two: 2, three: 3});
_.pairs({one: 1, two: 2, three: 3});
_.invert({Moe: "Moses", Larry: "Louis", Curly: "Jerome"});
_.functions(_);
_.extend({name: 'moe'}, {age: 50});
_.pick({name: 'moe', age: 50, userid: 'moe1'}, 'name', 'age');
_.pick({name: 'moe', age: 50, userid: 'moe1'}, function(value, key, object) {
    return _.isNumber(value);
});
_.omit({name: 'moe', age: 50, userid: 'moe1'}, 'userid');
_.omit({name: 'moe', age: 50, userid: 'moe1'}, function(value, key, object) {
    return _.isNumber(value);
});
var iceCream = {flavor: "chocolate"};
_.defaults(iceCream, {flavor: "vanilla", sprinkles: "lots"});
_.clone({name: 'moe'});
_.chain([1,2,3,200])
    .filter(function(num) { return num % 2 == 0; })
    .tap(alert)
    .map(function(num) { return num * num })
    .value();
_.has({a: 1, b: 2, c: 3}, "b");
var moe = {name: 'moe'};
'moe' === _.property('name')(moe);
var ready = _.matches({selected: true, visible: true});
var readyToGoList = _.filter(list, ready);
var moe   = {name: 'moe', luckyNumbers: [13, 27, 34]};
var clone = {name: 'moe', luckyNumbers: [13, 27, 34]};
moe == clone;
_.isEqual(moe, clone);
_.isEmpty([1, 2, 3]);
_.isEmpty({});
(function(){ return _.isArray(arguments); })();
_.isArray([1,2,3]);
_.isObject({});
_.isObject(1);
(function(){ return _.isArguments(arguments); })(1, 2, 3);
_.isArguments([1,2,3]);
_.isFunction(alert);
_.isString("moe");
_.isNumber(8.4 * 5);
_.isFinite(-101);
_.isFinite(-Infinity);
_.isBoolean(null);
_.isDate(new Date());
_.isRegExp(/moe/);
_.isNaN(NaN);
isNaN(undefined);
_.isNaN(undefined);
_.isNull(null);
_.isNull(undefined);
var moe = {name: 'moe'};
moe === _.identity(moe);
var moe = {name: 'moe'};
moe === _.constant(moe)();
_.random(0, 100);
_.mixin({
    capitalize: function(string) {
        return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
    }
});
_("fabio").capitalize();
var stooges = [{name: 'curly', age: 25}, {name: 'moe', age: 21}, {name: 'larry', age: 23}];
_.map(stooges, _.iteratee('age'));
_.uniqueId('contact_');
_.escape('Curly, Larry & Moe');
_.unescape('Curly, Larry &amp; Moe');
var object = {cheese: 'crumpets', stuff: function(){ return 'nonsense'; }};
_.result(object, 'cheese');
_.result(object, 'stuff');
_.now();

_.map([1, 2, 3], function(n){ return n * 2; });
_([1, 2, 3]).map(function(n){ return n * 2; });

var lyrics = [
    {line: 1, words: "I'm a lumberjack and I'm okay"},
    {line: 2, words: "I sleep all night and I work all day"},
    {line: 3, words: "He's a lumberjack and he's okay"},
    {line: 4, words: "He sleeps all night and he works all day"}
];

_.chain(lyrics)
    .map(function(line) { return line.words.split(' '); })
    .flatten()
    .reduce(function(counts, word) {
        counts[word] = (counts[word] || 0) + 1;
        return counts;
    }, {})
    .value();

var stooges = [{name: 'curly', age: 25}, {name: 'moe', age: 21}, {name: 'larry', age: 23}];
var youngest = _.chain(stooges)
    .sortBy(function(stooge){ return stooge.age; })
    .map(function(stooge){ return stooge.name + ' is ' + stooge.age; })
    .first()
    .value();
_([1, 2, 3]).value();
