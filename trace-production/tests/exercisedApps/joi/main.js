var Joi = require('joi');

// test 1
var schema = Joi.object().keys({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().regex(/[a-zA-Z0-9]{3,30}/),
    access_token: [Joi.string(), Joi.number()],
    birthyear: Joi.number().integer().min(1900).max(2013),
    email: Joi.string().email()
}).with('username', 'birthyear').without('password', 'access_token');

Joi.validate({username: 'abc', birthyear: 1994}, schema, function (err, value) {
});  // err === null -> valid

// test 2
var definition = ['key', 5, {a: true, b: [/^a/, 'boom']}];
var schema = Joi.compile(definition);

// Same as:

var schema = Joi.alternatives().try([
    Joi.string().valid('key'),
    Joi.number().valid(5),
    Joi.object().keys({
        a: Joi.boolean().valid(true),
        b: Joi.alternatives().try([
            Joi.string().regex(/^a/),
            Joi.string().valid('boom')
        ])
    })
]);

// test 3
var any = Joi.any();
any.validate('a', function (err, value) {
});


// test 4
var schema = {
    username: Joi.string(),
    password: Joi.string().strip()
};

schema.validate({username: 'test', password: 'hunter2'}, function (err, value) {
    // value = { username: 'test' }
});

var schema = Joi.array().items(Joi.string(), Joi.any().strip());

schema.validate(['one', 'two', true, false, 1, 2], function (err, value) {
    // value = ['one', 'two']
});

// test 5
var generateUsername = function (context) {

    return context.firstname.toLowerCase() + '-' + context.lastname.toLowerCase();
};
generateUsername.description = 'generated username';

var schema = {
    username: Joi.string().default(generateUsername),
    firstname: Joi.string(),
    lastname: Joi.string(),
    created: Joi.date().default(Date.now, 'time of creation'),
    status: Joi.string().default('registered')
};

Joi.validate({
    firstname: 'Jane',
    lastname: 'Doe'
}, schema, function (err, value) {

    // value.status === 'registered'
    // value.username === 'jane-doe'
    // value.created will be the time of validation
});

// test 6
var object = Joi.object().keys({
    a: Joi.number().min(1).max(10).integer(),
    b: 'some string'
});

object.validate({a: 5}, function (err, value) {
});