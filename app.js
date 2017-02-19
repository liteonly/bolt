var express = require('express'),
  app = express(),
  path = require('path'),
  bodyParser = require('body-parser'),
  util = require('./util')

app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

const cfg = {
  'port': 3001,
  'ngram_index_path': path.join(__dirname, 'tmp/ngram_index.json'),
  'token_index_path': path.join(__dirname, 'tmp/token_index.json'),
  'stopwords_path': path.join(__dirname, 'tmp/stopwords.json'),
  'term_frequency_map': path.join(__dirname, 'tmp/term_frequency_map.json'),
  'docs_path': path.join(__dirname, 'docs/')
}

app.get('/', function (req, res) {
  res.json('Hello Wanderer! I am Bolt :)')
})

app.post('/index', function (req, res, next) {
  if (!req.body.hasOwnProperty('id') || !req.body.hasOwnProperty('text') || !req.body.hasOwnProperty('title')) {
    console.log('Validation error')
  }
  util.indexFile(cfg, req.body, function (err, success) {
    if (err != null) {
      console.log(err)
    }
    console.log(success)
    res.json(success)
  })
})

app.use('/search', (req, res, next) => {
  var queryTokens = util.tokenize(req.query.q)
  console.log(queryTokens)
  console.log(process.index)
  return util.getRelevantDocuments(queryTokens).then((documents) => {
    return util.createPromises(documents)
  }).then((data) => {
    console.log(data)
    res.json({
      'success': true,
      'documents': data
    })
  }).catch((err) => {
    console.log(err)
  })
})

util.createRequiredPaths(cfg)
util.readJsonFile(cfg.token_index_path).then((jsonIndex) => {
  process.index = jsonIndex
  console.log('jsonIndex ' + jsonIndex)
  return util.readJsonFile(cfg.stopwords_path, [])
}).then((stopwords) => {
  process.stopwords = stopwords
  console.log('stopwords ' + process.stopwords)
  return util.readJsonFile(cfg.term_frequency_map)
}).then((termFrequencyMap) => {
  process.term_frequency_map = termFrequencyMap
  console.log(termFrequencyMap)
  app.listen(cfg.port, function () {
    console.log('Listening on port ' + cfg.port)
  })
})
.catch((err) => {
  console.log(err)
  throw new Error(err)
})
