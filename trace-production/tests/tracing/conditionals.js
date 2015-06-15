var num;

// if
if (true) {
    num = 42;
} else {
    num = 'foo';
}

// hook
num = true ? 42 : 'foo';
num = false ? 'foo' : 42;

// short circuiting
// truthy cases
num = 42 || 'foo';
num = '' || 42;
num = 'foo' && 42;

// falsy cases
num = 0 && 'foo';
num = 'foo' && 0;
num = '' || 0;

// switch
// first case
switch ('foo') {
    case 'foo':
    case 'bar':
        num = 42;
}
// second case
switch ('foo') {
    case 'bar':
    case 'foo':
        num = 42;
}