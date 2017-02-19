var async = require('async'),
	fs = require('fs'),
	path = require('path'),
	_ = require('lodash');

var configPath = '/tmp'
function preprocessor(query) {

	strippedString = query.replace(/\s/g, "");
	strippedString = strippedString.toLowerCase();
	// console.log(strippedString);
	ngrams = [];
	len = strippedString.length;
	for (start=0; start<len; start++) {
		for (step =1; step<=len-start; step ++) {
			ngrams.push(strippedString.substr(start, step));
		}
	}
	return ngrams;
}

function tokenize(query) {

	query = query.toLowerCase();
	tokens = query.split(/\s+/g);
	return removeStopWords(tokens);
}

function addDocToIndex(tokens, file_path) {
	return new Promise((resolve) => {
		if (tokens.length != 0) {
			tokens.forEach((token) => {
				if(process.index.hasOwnProperty(token)) {
					process.index[token].push(file_path);
				} else {
					process.index[token] = [file_path];
				}
				process.index[token] = _.uniq(process.index[token])
			})
		}
		resolve()
	})
}

function getFilePath(configPath, id) {

	return `${configPath}${id}.json`;
}

function openFile(file_path) {
	return new Promise((resolve) => {
		fs.open(file_path, 'w', function (err, descriptor) {
			if (err != null) {
				throw new Error(err);
			}
			resolve(descriptor);
		})
	})
}

function writeDocument(json_data, file_path) {
	return new Promise((resolve) => {
		openFile(file_path).then((descriptor) => {
			fs.write(descriptor, JSON.stringify(json_data, null, 2), function (err) {
				if (err) {
					throw new Error(err);
				}
				resolve();
			})
		}).catch((err) => {
			throw new Error(err);
		})
	})
} 

function indexFile(cfg, req_body, cb) {
	// const ngrams = preprocessor(req_body.text);
	const tokens = tokenize(req_body.text);
	const doc_path = getFilePath(cfg.docs_path, req_body.id);
	const doc_id = doc_path.split('/').slice(-1)[0];
	writeDocument(req_body, doc_path)
	.then(() => {
		return addDocToIndex(tokens, doc_id)
	})
	.then(() => {
		return storeTermFrequency(tokens, cfg.term_frequency_map, doc_id)
	})
	.then(() => {
		console.log(process.index);
		return writeDocument(process.index, cfg.token_index_path)
	})
	.then(() => {
		resp = {
			'success': true
		}
		cb(null, resp)
	})
	.catch((err) => {
		console.error(err);
	});
}

function readJsonFile(file_path, default_value= {}) {

	return new Promise((resolve) => {
		fs.readFile(file_path, function (err, json_string) {
			var json_data;
			if (err!= null) {
				throw new Error(err);
			}
			try {
				json_data = JSON.parse(json_string);
			} catch(err) {
				json_data = default_value;
			}
			resolve(json_data);
		})
	})
}

function removeStopWords(tokens) {
	tokens.forEach((token, index) => {
		if (process.stopwords.indexOf(token) > -1) {
			tokens.splice(index, 1);
		}
	})
	return tokens;
}

function getRelevantDocuments(tokens) {

	return new Promise((resolve) => {
		var documents = [];
		tokens.forEach((token) => {
			if (process.index.hasOwnProperty(token)) {
				documents = documents.concat(process.index[token]);
			}
		})
		documents = _.uniq(documents);
		console.log(documents);
		selected_docs_tf = scoreDocumentsByTF(tokens, documents);
		resolve(selected_docs_tf);
	});
}

function scoreDocumentsByTF(tokens, documents) {
	selected_docs_tf = [];
	console.log("Inside Scoring");
	console.log(tokens);
	console.log(documents);
	console.log(process.term_frequency_map);
	documents.forEach((doc) => {
		// console.log(process.term_frequency_map[doc]);
		tf_score = 0;
		tokens.forEach((token) => {
			if (process.term_frequency_map[doc].hasOwnProperty(token)) {
				console.log(doc, token, Math.log10(process.term_frequency_map[doc][token]+1));
				tf_score += Math.log10(process.term_frequency_map[doc][token]+1);
			}
		});
		selected_docs_tf.push({'doc': doc, tf_score: tf_score});
	});
	console.log(selected_docs_tf);
	return _.sortBy(selected_docs_tf, [(doc) => {return (1/ (1+ doc.tf_score));}]);
}

function storeTermFrequency(tokens, term_frequency_path, doc_id) {
	return new Promise((resolve) => {
		tf_map = {};
		tokens.forEach((token) => {
			if (tf_map.hasOwnProperty(token)) {
				tf_map[token] += 1
			} else {
				tf_map[token] = 1;
			}
		});
		process.term_frequency_map[doc_id] = tf_map;
		console.log(process.term_frequency_map);
		return writeDocument(process.term_frequency_map, term_frequency_path).then(() => resolve())
	})
}

module.exports = {
	indexFile : indexFile,
	readJsonFile : readJsonFile,
	tokenize : tokenize,
	getRelevantDocuments : getRelevantDocuments
}