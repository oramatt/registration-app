const express = require('express');
const routes = require('./routes/index');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');


console.log(path.join(__dirname,'views'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.static('public'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', routes);

module.exports = app;