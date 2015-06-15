function test1(o){
    o.p;
}

test1({p: 42});
test1({p: 'foo'});

function test2(o){
    o.p;
}

test2({p: 42});
test2({p: undefined});

function test3(o){
    o.p;
}

test3({p: undefined});