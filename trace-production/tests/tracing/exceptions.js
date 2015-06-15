function thrower() {
    try {
        throw 'foo';
    } catch (e) {
        var v = e;
        throw v;

    }
}
function catcher(){
    try{
        thrower();
    }catch(e){
        return e;
    }
}
var result = catcher();
