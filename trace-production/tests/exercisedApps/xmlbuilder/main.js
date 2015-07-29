var builder = require('xmlbuilder/lib/XMLElement');
//
//var xml = builder.create('root')
//    .ele('xmlbuilder', {'for': 'node-js'})
//    .ele('repo', {'type': 'git'}, 'git://github.com/oozcitak/xmlbuilder-js.git')
//    .end({pretty: true});
//
//builder.create({
//    root: {
//        xmlbuilder: {
//            '@for': 'node-js', // attributes start with @
//            repo: {
//                '@type': 'git',
//                '#text': 'git://github.com/oozcitak/xmlbuilder-js.git' // #text denotes element text
//            }
//        }
//    }
//});
//
//var root = builder.create('squares');
//root.com('f(x) = x^2');
//for (var i = 1; i <= 5; i++) {
//    var item = root.ele('data');
//    item.att('x', i);
//    item.att('y', i * i);
//}