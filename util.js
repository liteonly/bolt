var fs = require('fs'),
  path = require('path'),
  _ = require('lodash')

// function preprocessor (query) {
//   strippedString = query.replace(/\s/g, '')
//   strippedString = strippedString.toLowerCase()
// console.log(strippedString);
//   ngrams = []
//   len = strippedString.length
//   for (start = 0; start < len; start++) {
//     for (step = 1; step <= len - start; step++) {
//       ngrams.push(strippedString.substr(start, step))
//     }
//   }
//   return ngrams
// }

function tokenize (query) {
  query = query.toLowerCase()
  var tokens = query.split(/\s+/g)
  return removeStopWords(tokens)
}

function addDocToIndex (tokens, filePath) {
  return new Promise((resolve) => {
    if (tokens.length !== 0) {
      tokens.forEach((token) => {
        if (process.index.hasOwnProperty(token)) {
          process.index[token].push(filePath)
        } else {
          process.index[token] = [filePath]
        }
        process.index[token] = _.uniq(process.index[token])
      })
    }
    resolve()
  })
}

function getFilePath (configPath, id) {
  return `${configPath}${id}.json`
}

function openFile (filePath, fallbackMode) {
  return new Promise((resolve) => {
    fs.open(filePath, 'wx+', (err, descriptor) => {
      if (err != null) {
        if (err.code === 'EEXIST') {
          fs.open(filePath, fallbackMode, (err, fallbackDescriptor) => {
            if (err != null) {
              throw new Error()
            }
            resolve(fallbackDescriptor)
          })
          return
        } else {
          throw new Error(err)
        }
      }
      resolve(descriptor)
    })
  })
}

function writeDocument (jsonData, filePath) {
  return new Promise((resolve) => {
    openFile(filePath, 'w').then((descriptor) => {
      fs.write(descriptor, JSON.stringify(jsonData, null, 2), function (err) {
        if (err) {
          throw new Error(err)
        }
        resolve()
      })
    }).catch((err) => {
      throw new Error(err)
    })
  })
}

function indexFile (cfg, reqBody, cb) {
  // const ngrams = preprocessor(reqBody.text);
  const tokens = tokenize(reqBody.text)
  const docPath = getFilePath(cfg.docs_path, reqBody.id)
  const docId = docPath.split('/').slice(-1)[0]
  if (process.term_frequency_map.hasOwnProperty(docId)) {
    var resp = {
      'success': false,
      'error': 'A document already exists with that given docId. Try again with a different Id'
    }
    return cb(null, resp)
  }
  writeDocument(reqBody, docPath).then(() => {
    return addDocToIndex(tokens, docId)
  }).then(() => {
    return storeTermFrequency(tokens, cfg.term_frequency_map, docId)
  }).then(() => {
    console.log(process.index)
    return writeDocument(process.index, cfg.token_index_path)
  }).then(() => {
    var resp = {
      'success': true
    }
    cb(null, resp)
  }).catch((err) => {
    console.error(err)
  })
}

function readJsonFile (filePath, defaultValue = {}) {
  return new Promise((resolve) => {
    openFile(filePath, 'r').then((fileDescriptor) => {
      fs.readFile(fileDescriptor, function (err, jsonString) {
        var jsonData
        if (err != null) {
          throw new Error(err)
        }
        try {
          jsonData = JSON.parse(jsonString)
        } catch (err) {
          jsonData = defaultValue
        }
        resolve(jsonData)
      })
    }).catch((err) => {
      throw new Error(err)
    })
  })
}

function removeStopWords (tokens) {
  tokens.forEach((token, index) => {
    if (process.stopwords.indexOf(token) > -1) {
      tokens.splice(index, 1)
    }
  })
  return tokens
}

function getRelevantDocuments (tokens) {
  return new Promise((resolve) => {
    var documents = []
    tokens.forEach((token) => {
      if (process.index.hasOwnProperty(token)) {
        documents = documents.concat(process.index[token])
      }
    })
    documents = _.uniq(documents)
    console.log(documents)
    var selectedDocsTf = scoreDocumentsByTF(tokens, documents)
    resolve(selectedDocsTf)
  })
}

function scoreDocumentsByTF (tokens, documents) {
  var selectedDocsTf = []
  console.log('Inside Scoring')
  console.log(tokens)
  console.log(documents)
  console.log(process.term_frequency_map)
  documents.forEach((doc) => {
// console.log(process.term_frequency_map[doc]);
    var tfScore = 0
    tokens.forEach((token) => {
      if (process.term_frequency_map[doc].hasOwnProperty(token)) {
        console.log(doc, token, Math.log10(process.term_frequency_map[doc][token] + 1))
        tfScore += Math.log10(process.term_frequency_map[doc][token] + 1)
      }
    })
    selectedDocsTf.push({'doc': doc, tfScore: tfScore})
  })
  console.log(selectedDocsTf)
  return _.sortBy(selectedDocsTf, [(doc) => { return (1 / (1 + doc.tfScore)) }])
}

function storeTermFrequency (tokens, termFrequencyPath, docId) {
  return new Promise((resolve) => {
    var tfMap = {}
    tokens.forEach((token) => {
      if (tfMap.hasOwnProperty(token)) {
        tfMap[token] += 1
      } else {
        tfMap[token] = 1
      }
    })
    process.term_frequency_map[docId] = tfMap
    console.log(process.term_frequency_map)
    return writeDocument(process.term_frequency_map, termFrequencyPath).then(() => resolve())
  })
}

function createRequiredPaths (cfg) {
  var reqPaths = ['docs']
  reqPaths.forEach((p) => {
    var fullPath = path.join(__dirname, p)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath)
    }
  })
}

function promisifyRead (filePath) {
  return new Promise((resolve) => {
    fs.readFile(filePath, (err, data) => {
      if (err != null) {
        throw new Error(err)
      }
      resolve(JSON.parse(data))
    })
  })
}

function createPromises (documents) {
  var promises = []
  documents.forEach((d) => {
    promises.push(promisifyRead(path.join(__dirname, 'docs', d.doc)))
  })
  return Promise.all(promises)
}

module.exports = {
  indexFile: indexFile,
  readJsonFile: readJsonFile,
  tokenize: tokenize,
  getRelevantDocuments: getRelevantDocuments,
  createRequiredPaths: createRequiredPaths,
  createPromises: createPromises
}
