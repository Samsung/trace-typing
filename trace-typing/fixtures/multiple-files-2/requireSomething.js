// console.log(__dirname)
var localRequireProperties = require('./exportProperties');
var localRequireObject = require('./exportObject');
var globalRequire = require('fs');

localRequireProperties.prop1;
localRequireProperties.prop2;


localRequireObject.prop1;
localRequireObject.prop2;

globalRequire.existsSync;