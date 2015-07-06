var Handlebars = require('handlebars');

// test 1
var source = "<p>Hello, my name is {{name}}. I am from {{hometown}}. I have " +
    "{{kids.length}} kids:</p>" +
    "<ul>{{#kids}}<li>{{name}} is {{age}}</li>{{/kids}}</ul>";
var template = Handlebars.compile(source);

var data = {
    "name": "Alan", "hometown": "Somewhere, TX",
    "kids": [{"name": "Jimmy", "age": "12"}, {"name": "Sally", "age": "4"}]
};
var result = template(data);


// test 2
Handlebars.registerHelper('link_to', function () {
    return new Handlebars.SafeString("<a href='" + Handlebars.Utils.escapeExpression(this.url) + "'>" + Handlebars.Utils.escapeExpression(this.body) + "</a>");
});

var context = {posts: [{url: "/hello-world", body: "Hello World!"}]};
var source = "<ul>{{#posts}}<li>{{link_to}}</li>{{/posts}}</ul>"

var template = Handlebars.compile(source);
template(context);

// test 3
Handlebars.registerHelper('link_to', function (title, options) {
    return "<a href='/posts" + this.url + "'>" + title + "!</a>"
});

var context = {posts: [{url: "/hello-world", body: "Hello World!"}]};
var source = '<ul>{{#posts}}<li>{{{link_to "Post"}}}</li>{{/posts}}</ul>'

var template = Handlebars.compile(source);
template(context);


// test 4
var source = "<ul>{{#people}}<li>{{#link}}{{name}}{{/link}}</li>{{/people}}</ul>";
Handlebars.registerHelper('link', function (options) {
    return '<a href="/people/' + this.id + '">' + options.fn(this) + '</a>';
});
var template = Handlebars.compile(source);

var data = {
    "people": [
        {"name": "Alan", "id": 1},
        {"name": "Yehuda", "id": 2}
    ]
};
template(data);

// test 5
var source = "<ul>{{#people}}<li>{{> link}}</li>{{/people}}</ul>";

Handlebars.registerPartial('link', '<a href="/people/{{id}}">{{name}}</a>')
var template = Handlebars.compile(source);

var data = {
    "people": [
        {"name": "Alan", "id": 1},
        {"name": "Yehuda", "id": 2}
    ]
};

template(data);

// test 6
var source = "<div>{{> roster rosterProperties people=listOfPeople}}</div>";

Handlebars.registerPartial('roster', '<h2>{{rosterName}}</h2>{{#people}}<span>{{id}}: {{name}}</span>{{/people}}')
var template = Handlebars.compile(source);

var data = {
    "listOfPeople": [
        {"name": "Alan", "id": 1},
        {"name": "Yehuda", "id": 2}
    ],
    "rosterProperties": {
        "rosterName": "Cool People"
    }
};

template(data);
