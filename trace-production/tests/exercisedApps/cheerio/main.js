var cheerio = require('cheerio'),
    $ = cheerio.load('<ul id="fruits"><li class="apple">Apple</li><li class="orange">Orange</li><li class="pear">Pear</li></ul>');

$('.apple', '#fruits').text()
//=> Apple

$('ul .pear').attr('class')
//=> pear

$('li[class=orange]').html()
//=> <li class="orange">Orange</li>


$('ul').attr('id')
//=> fruits

$('.apple').attr('id', 'favorite').html()
//=> <li class="apple" id="favorite">Apple</li>

$('<div data-apple-color="red"></div>').data()
//=> { appleColor: 'red' }

$('<div data-apple-color="red"></div>').data('data-apple-color')
//=> 'red'

var apple = $('.apple').data('kind', 'mac')
apple.data('kind')
//=> 'mac'

$('input[type="text"]').val()
//=> input_text

$('.pear').removeAttr('class').html()
//=> <li>Pear</li>

$('.pear').hasClass('pear')
//=> true

$('apple').hasClass('fruit')
//=> false

$('li').hasClass('pear')
//=> true

$('.pear').addClass('fruit').html()
//=> <li class="pear fruit">Pear</li>

$('.apple').addClass('fruit red').html()
//=> <li class="apple fruit red">Apple</li>

$('.pear').removeClass('pear').html()
//=> <li class="">Pear</li>

$('.apple').addClass('red').removeClass().html()
//=> <li class="">Apple</li>

$('.apple.green').toggleClass('fruit green red').html()
//=> <li class="apple fruit red">Apple</li>

$('.apple.green').toggleClass('fruit green red', true).html()
//=> <li class="apple green fruit red">Apple</li>

$('<form><input name="foo" value="bar" /></form>').serializeArray()
//=> [ { name: 'foo', value: 'bar' } ]

$('#fruits').find('li').length
//=> 3
$('#fruits').find($('.apple')).length
//=> 1

$('.pear').parent().attr('id')
//=> fruits

$('.orange').parents().length
// => 2
$('.orange').parents('#fruits').length
// => 1

$('.orange').parentsUntil('#food').length
// => 1

$('.orange').closest()
// => []
$('.orange').closest('.apple')
// => []
$('.orange').closest('li')
// => [<li class="orange">Orange</li>]
$('.orange').closest('#fruits')
// => [<ul id="fruits"> ... </ul>]

$('.apple').next().hasClass('orange')
//=> true

$('.apple').nextAll()
//=> [<li class="orange">Orange</li>, <li class="pear">Pear</li>]
$('.apple').nextAll('.orange')
//=> [<li class="orange">Orange</li>]

$('.apple').nextUntil('.pear')
//=> [<li class="orange">Orange</li>]

$('.orange').prev().hasClass('apple')
//=> true

$('.pear').prevAll()
//=> [<li class="orange">Orange</li>, <li class="apple">Apple</li>]
$('.pear').prevAll('.orange')
//=> [<li class="orange">Orange</li>]

$('.pear').prevUntil('.apple')
//=> [<li class="orange">Orange</li>]

$('li').slice(1).eq(0).text()
//=> 'Orange'

$('li').slice(1, 2).length
//=> 1

$('.pear').siblings().length
//=> 2

$('.pear').siblings('.orange').length
//=> 1

$('#fruits').children().length
//=> 3

$('#fruits').children('.pear').text()
//=> Pear

$('#fruits').contents().length
//=> 3

var fruits = [];

$('li').each(function(i, elem) {
    fruits[i] = $(this).text();
});

fruits.join(', ');
//=> Apple, Orange, Pear

$('li').map(function(i, el) {
    // this === el
    return $(this).text();
}).get().join(' ');
//=> "apple orange pear"

$('li').filter('.orange').attr('class');
//=> orange

$('li').filter(function(i, el) {
    // this === el
    return $(this).attr('class') === 'orange';
}).attr('class')
//=> orange

$('li').not('.apple').length;
//=> 2

$('li').not(function(i, el) {
    // this === el
    return $(this).attr('class') === 'orange';
}).length;
//=> 2

$('ul').has('.pear').attr('id');
//=> fruits

$('ul').has($('.pear')[0]).attr('id');
//=> fruits

$('#fruits').children().first().text()
//=> Apple

$('#fruits').children().last().text()
//=> Pear

$('li').eq(0).text()
//=> Apple

$('li').eq(-1).text()
//=> Pear


$('li').get(0).tagName
//=> li



$('li').get().length
//=> 3

$('.pear').index()
//=> 2
$('.orange').index('li')
//=> 1
$('.apple').index($('#fruit, li'))
//=> 1

$('li').eq(0).end().length
//=> 3

$('.apple').add('.orange').length
//=> 2

$('li').eq(0).addBack('.orange').length
//=> 2

$('ul').append('<li class="plum">Plum</li>')
$.html()
//=>  <ul id="fruits">
//      <li class="apple">Apple</li>
//      <li class="orange">Orange</li>
//      <li class="pear">Pear</li>
//      <li class="plum">Plum</li>
//    </ul>

$('ul').prepend('<li class="plum">Plum</li>')
$.html()
//=>  <ul id="fruits">
//      <li class="plum">Plum</li>
//      <li class="apple">Apple</li>
//      <li class="orange">Orange</li>
//      <li class="pear">Pear</li>
//    </ul>

$('.apple').after('<li class="plum">Plum</li>')
$.html()
//=>  <ul id="fruits">
//      <li class="apple">Apple</li>
//      <li class="plum">Plum</li>
//      <li class="orange">Orange</li>
//      <li class="pear">Pear</li>
//    </ul>

$('<li class="plum">Plum</li>').insertAfter('.apple')
$.html()
//=>  <ul id="fruits">
//      <li class="apple">Apple</li>
//      <li class="plum">Plum</li>
//      <li class="orange">Orange</li>
//      <li class="pear">Pear</li>
//    </ul>

$('.apple').before('<li class="plum">Plum</li>')
$.html()
//=>  <ul id="fruits">
//      <li class="plum">Plum</li>
//      <li class="apple">Apple</li>
//      <li class="orange">Orange</li>
//      <li class="pear">Pear</li>
//    </ul>

$('<li class="plum">Plum</li>').insertBefore('.apple')
$.html()
//=>  <ul id="fruits">
//      <li class="plum">Plum</li>
//      <li class="apple">Apple</li>
//      <li class="orange">Orange</li>
//      <li class="pear">Pear</li>
//    </ul>

$('.pear').remove()
$.html()
//=>  <ul id="fruits">
//      <li class="apple">Apple</li>
//      <li class="orange">Orange</li>
//    </ul>

var plum = $('<li class="plum">Plum</li>')
$('.pear').replaceWith(plum)
$.html()
//=> <ul id="fruits">
//     <li class="apple">Apple</li>
//     <li class="orange">Orange</li>
//     <li class="plum">Plum</li>
//   </ul>

$('ul').empty()
$.html()
//=>  <ul id="fruits"></ul>

$('.orange').html()
//=> Orange

$('#fruits').html('<li class="mango">Mango</li>').html()
//=> <li class="mango">Mango</li>

$('.orange').text()
//=> Orange

$('ul').text()
//=>  Apple
//    Orange
//    Pear

var moreFruit = $('#fruits').clone()


$.root().append('<ul id="vegetables"></ul>').html();
//=> <ul id="fruits">...</ul><ul id="vegetables"></ul>