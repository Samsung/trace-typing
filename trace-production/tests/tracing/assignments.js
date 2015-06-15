var a = 42,
    b = 'foo',
    c = {},
    d = {p: 'bar'},
    e = function () {
    },
    f = undefined,
    g,
    h = {p: a},
    i = h.p;
function j(){}
k = 87;
c.p = 42;


var l = 3;
l = l++;
l = 10;
l = l--;
l = 20;
l = ++l;
l = 30;
l = --l;

var m1 = {};
var m2 = {};
var n = m1.p = m2.p = 42;

var o = 0;
o += 37;

var p = {p: 42};
p.p += 37;
p['p'] += 37;
var p = (p['p'] += 37);

var q = {}, r;
r = q.p;
r = q['p'];
q.p = r;
q['p'] = r;

var s = {p: 42}, t;
t = s.p++;

var u = 42;
[][u++];
[++u];