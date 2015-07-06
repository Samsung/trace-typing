var xml2js = require('xml2js');

// test 1
var parseString = xml2js.parseString;
var xml = "<root>Hello xml2js!</root>"
parseString(xml, function (err, result) {
    // console.dir(result);
});

// test 2
var obj = {name: "Super", Surname: "Man", age: 23};
var builder = new xml2js.Builder();
var xml = builder.buildObject(obj);