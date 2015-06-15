var program = require('commander');

program
    .version('0.0.1')
    .option('-p, --peppers', 'Add peppers')
    .option('-P, --pineapple', 'Add pineapple')
    .option('-b, --bbq', 'Add bbq sauce')
    .option('-c, --cheese [type]', 'Add the specified type of cheese [marble]', 'marble')
    .parse(['dummy','dummy','-p'])
    .parse(['dummy','dummy','--peppers'])
    .parse(['dummy','dummy','-P'])
    .parse(['dummy','dummy','--pineapple'])
    .parse(['dummy','dummy','-c'])
    .parse(['dummy','dummy','-c', 'foo']);


program
    .version('0.0.1')
    .command('rmdir <dir> [otherDirs...]')
    .action(function (dir, otherDirs) {
        if (otherDirs) {
            otherDirs.forEach(function (oDir) {

            });
        }
    });

program.parse(process.argv);

function range(val) {
    return val.split('..').map(Number);
}

function list(val) {
    return val.split(',');
}

function collect(val, memo) {
    memo.push(val);
    return memo;
}

function increaseVerbosity(v, total) {
    return total + 1;
}

program
    .version('0.0.1')
    .usage('[options] <file ...>')
    .option('-i, --integer <n>', 'An integer argument', parseInt)
    .option('-f, --float <n>', 'A float argument', parseFloat)
    .option('-r, --range <a>..<b>', 'A range', range)
    .option('-l, --list <items>', 'A list', list)
    .option('-o, --optional [value]', 'An optional value')
    .option('-c, --collect [value]', 'A repeatable value', collect, [])
    .option('-v, --verbose', 'A value that can be increased', increaseVerbosity, 0)
    .parse(['dummy','dummy','-i', '423'])
    .parse(['dummy','dummy','-i', 'x'])
    .parse(['dummy','dummy','-f', '324'])
    .parse(['dummy','dummy','-f', '324.2'])
    .parse(['dummy','dummy','-r', '324..2342'])
    .parse(['dummy','dummy','-l', 'a,b,c'])
    .parse(['dummy','dummy','-v']);