var parse = require('minimist');

// inline the parse calls from their test suite
parse(['moo', '--honk', 'cow'], {
boolean: true
});
parse(['moo', '--honk', 'cow', '-p', '55', '--tacos=good'], {
boolean: true
});

parse(['moo'], {
boolean: ['t', 'verbose'],
default: { verbose: false, t: false }
});
parse([ '-x', '-z', 'one', 'two', 'three' ], {
boolean: ['x','y','z']
});
var aliased = [ '-h', 'derp' ];
var regular = [ '--herp', 'derp' ];
var opts = {
herp: { alias: 'h', boolean: true }
};
parse(aliased, {
boolean: 'herp',
alias: { h: 'herp' }
});
parse(regular, {
boolean: 'herp',
alias: { h: 'herp' }
});

aliased = [ '-h', 'derp' ];
regular = [ '--herp', 'derp' ];
var opts2 = {
alias: { 'h': 'herp' },
boolean: 'herp'
};
parse(aliased, opts2);
parse(regular, opts2);

aliased = [ '-h', 'true' ];
regular = [ '--herp', 'true' ];
var opts3 = {
alias: { h: 'herp' },
boolean: 'h'
};
parse(aliased, opts3);
parse(regular, opts3);

parse(['--boool', '--other=true'], {
boolean: 'boool'
});
parse(['--boool', '--other=false'], {
boolean: 'boool'
});

parse([ '-n', '-' ])
parse([ '-' ])
parse([ '-f-' ])
parse([ '-b', '-' ], { boolean: 'b' })
parse([ '-s', '-' ], { string: 's' })
parse([ '-a', '--', 'b' ])
parse([ '--a', '--', 'b' ])
parse([ '--a', '--', 'b' ])
parse([ '--name', 'John', 'before', '--', 'after' ], { '--': true })


parse([], {
boolean: 'sometrue',
default: { sometrue: true }
});
parse([], {
boolean: 'somefalse',
default: { somefalse: false }
});
parse([], {
boolean: 'maybe',
default: { maybe: null }
});
parse(['--maybe'], {
boolean: 'maybe',
default: { maybe: null }
});


parse(['--a.b', '22'], {default: {'a.b': 11}, alias: {'a.b': 'aa.bb'}});
parse('', {default: {'a.b': 11}, alias: {'a.b': 'aa.bb'}});
parse('', {default: {'a.b': 11}});


parse([ '--bool' ])
parse([ '--pow', 'xixxle' ])
parse([ '--pow=xixxle' ])
parse([ '--host', 'localhost', '--port', '555' ])
parse([ '--host=localhost', '--port=555' ])


parse([
'-x', '1234',
'-y', '5.67',
'-z', '1e7',
'-w', '10f',
'--hex', '0xdeadbeef',
'789'
]);

parse([ '-x', 1234, 789 ]);



parse([ '--no-moo' ])
parse([ '-v', 'a', '-v', 'b', '-v', 'c' ])
parse([
'--name=meowmers', 'bare', '-cats', 'woo',
'-h', 'awesome', '--multi=quux',
'--key', 'value',
'-b', '--bool', '--no-meep', '--multi=baz',
'--', '--not-a-flag', 'eek'
])
parse([ '-t', 'moo' ], { boolean: 't' });
parse(['--verbose', 'false', 'moo', '-t', 'true'], {
boolean: [ 't', 'verbose' ],
default: { verbose: true }
});
parse([ '-s', "X\nX" ])
parse([ "--s=X\nX" ])
parse([ '-s', '0001234' ], { string: 's' })
parse([ '-x', '56' ], { string: 'x' })
parse([ ' ', ' ' ], { string: '_' })
parse([ '-s' ], { string: 's' })
parse([ '--str' ], { string: 'str' })
parse([ '-art' ], {
string: [ 'a', 't' ]
});
parse([ '--str', '000123' ], {
string: 's',
alias: { s: 'str' }
});
parse([ '-s', '000123' ], {
string: 'str',
alias: { str: 's' }
});
parse([ '-I/foo/bar/baz' ])
parse([ '-xyz/foo/bar/baz' ])
parse([ '-f', '11', '--zoom', '55' ], {
alias: { z: 'zoom' }
});
parse([ '-f', '11', '--zoom', '55' ], {
alias: { z: [ 'zm', 'zoom' ] }
});
parse([
'--foo.bar', '3', '--foo.baz', '4',
'--foo.quux.quibble', '5', '--foo.quux.o_O',
'--beep.boop'
]);


parse([ '-b', '123' ], { boolean: 'b' });





parse([ '-n123' ])
parse([ '-123', '456' ])
parse([ '-b' ]),
parse([ 'foo', 'bar', 'baz' ])
parse([ '-cats' ])
parse([ '-cats', 'meow' ])
parse([ '-h', 'localhost' ])
parse([ '-h', 'localhost', '-p', '555' ])
parse([ '-h', 'localhost', '-fp', '555', 'script.js' ])
parse([ '-h', 'localhost', '-fp', '555', 'script.js' ])




parse(['--aaa', 'bbb', 'ccc', '--ddd'], {
stopEarly: true
});



var unknown = [];
function unknownFn(arg) {
unknown.push(arg);
return false;
}
var aliased = [ '-h', 'true', '--derp', 'true' ];
var regular = [ '--herp', 'true', '-d', 'true' ];
var opts = {
alias: { h: 'herp' },
boolean: 'h',
unknown: unknownFn
};
parse(aliased, opts);
parse(regular, opts);

var unknown2 = [];
function unknownFn2(arg) {
unknown2.push(arg);
return false;
}
var argv = parse(['--honk', '--tacos=good', 'cow', '-p', '55'], {
boolean: true,
unknown: unknownFn2
});


var unknown3 = [];
function unknownFn3(arg) {
unknown3.push(arg);
return false;
}
var aliased = [ '-h', 'hello', '--derp', 'goodbye' ];
var regular = [ '--herp', 'hello', '-d', 'moon' ];
var opts5 = {
alias: { h: 'herp' },
string: 'h',
unknown: unknownFn3
};
parse(aliased, opts5);
parse(regular, opts5);


var unknown4 = [];
function unknownFn4(arg) {
unknown4.push(arg);
return false;
}
var aliased = [ '-h', 'hello' ];
var regular = [ '--herp', 'hello' ];
var opts6 = {
default: { 'h': 'bar' },
alias: { 'h': 'herp' },
unknown: unknownFn4
};
parse(aliased, opts6);
parse(regular, opts6);


var unknown5 = [];
function unknownFn5(arg) {
unknown5.push(arg);
return false;
}
var aliased = [ '--bad', '--', 'good', 'arg' ];
var opts7 = {
'--': true,
unknown: unknownFn5
};
var argv = parse(aliased, opts7);


parse([ '-x', '\t' ])








