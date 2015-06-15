for (var i in {}) {
    i;
}

for (i in {}) {
    i;
}

var o = {};

// rejected by syntactic pre-pass
//for(o.p in {}){
//    o.p;
//}