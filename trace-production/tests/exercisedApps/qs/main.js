var Qs = require('qs');

var obj = Qs.parse('a=c');    // { a: 'c' }
var str = Qs.stringify(obj);  // 'a=c'
Qs.parse('a.hasOwnProperty=b', {plainObjects: true});

Qs.parse('a.hasOwnProperty=b', {allowPrototypes: true});
Qs.parse('a%5Bb%5D=c');
Qs.parse('a[b][c][d][e][f][g][h][i]=j', {depth: 1});
Qs.parse('a=b&c=d', {parameterLimit: 1});
Qs.parse('a=b;c=d', {delimiter: ';'});
Qs.parse('a=b;c=d,e=f', {delimiter: /[;,]/});
Qs.parse('a.b=c', {allowDots: false});
Qs.parse('a[]=b&a[]=c');
Qs.parse('a[1]=c&a[0]=b');
Qs.parse('a[1]=b&a[15]=c');
Qs.parse('a[]=&a[]=b');
Qs.parse('a[0]=b&a[1]=&a[2]=c');
Qs.parse('a[100]=b');


Qs.parse('a[1]=b', {arrayLimit: 0});

Qs.parse('a[]=b', {parseArrays: false});


Qs.parse('a[0]=b&a[b]=c');


Qs.parse('a[][b]=c');

Qs.stringify({a: 'b'});
Qs.stringify({a: {b: 'c'}});

Qs.stringify({a: ['b', 'c', 'd']});

Qs.stringify({a: ['b', 'c', 'd']}, {indices: false});

Qs.stringify({a: ['b', 'c']}, {arrayFormat: 'indices'})

Qs.stringify({a: ['b', 'c']}, {arrayFormat: 'brackets'})

Qs.stringify({a: ['b', 'c']}, {arrayFormat: 'repeat'})

Qs.stringify({a: ''});

Qs.stringify({a: null, b: undefined});

Qs.stringify({a: 'b', c: 'd'}, {delimiter: ';'});
function filterFunc(prefix, value) {
    if (prefix == 'b') {
        // Return an `undefined` value to omit a property.
        return;
    }
    if (prefix == 'e[f]') {
        return value.getTime();
    }
    if (prefix == 'e[g][0]') {
        return value * 2;
    }
    return value;
}
Qs.stringify({a: 'b', c: 'd', e: {f: new Date(123), g: [2]}}, {filter: filterFunc})

Qs.stringify({a: 'b', c: 'd', e: 'f'}, {filter: ['a', 'e']})

Qs.stringify({a: ['b', 'c', 'd'], e: 'f'}, {filter: ['a', 0, 2]})


Qs.stringify({a: null, b: ''});

Qs.parse('a&b=')


Qs.stringify({a: null, b: ''}, {strictNullHandling: true});

Qs.parse('a&b=', {strictNullHandling: true});

