var express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	util = require('./util');

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var port = 3001;
var cfg = {
	'port' : 3001,
	'ngram_index_path'   : __dirname + '/tmp/ngram_index.json',
	'token_index_path'   : __dirname + '/tmp/token_index.json',
	'stopwords_path'     : __dirname + '/tmp/stopwords.json',
	'term_frequency_map' : __dirname + '/tmp/term_frequency_map.json',
	'docs_path' : __dirname + '/docs/'
}

app.get('/', function (req, res) {
	res.json('Hello Wanderer! I am Bolt :)')	
});

app.post('/index', function (req, res, next) {
	if (!req.body.hasOwnProperty('id') || !req.body.hasOwnProperty('text') || !req.body.hasOwnProperty('title')) {
		console.log('Validation error');
	}
	util.indexFile(cfg, req.body, function (err, success) {
		if (err != null) {
			console.log(err);
		}
		console.log(success);
		res.json(success);
	});
});

app.use('/search', (req, res, next) => {
	var query_tokens = util.tokenize(req.query.q)
	console.log(query_tokens);
	console.log(process.index);
	return util.getRelevantDocuments(query_tokens)
	.then((documents) => {
		res.json({
			'success' : true,
			'documents' : documents
		});
	}).catch((err) => {
		console.log(err);
	})
});


util.readJsonFile(cfg.token_index_path).then((json_index) => {
	process.index = json_index;
	console.log("json_index " + json_index);
	return util.readJsonFile(cfg.stopwords_path, [])
}).then((stopwords) => {
	process.stopwords = stopwords;
	console.log("stopwords " + process.stopwords);
	return util.readJsonFile(cfg.term_frequency_map)
}).then((term_frequency_map) => {
	process.term_frequency_map = term_frequency_map;
	console.log(term_frequency_map);
	app.listen(cfg.port, function () {
		console.log('Listening on port '+ cfg.port);
	})
})
.catch((err) => {
	console.log(err);
	throw new Error(err);
})