var ejs = require('ejs'),
    users = ['geddy', 'neil', 'alex'];

ejs.compile("<% if (user) { %>" + "<h2><%= user.name %></h2>" + "<% } %>");

ejs.render('<%= users.join(" | "); %>', {users: users});

ejs.render('<?= users.join(" | "); ?>', {users: users}, {delimiter: '?'});

