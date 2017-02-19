# Bolt
----

## What is Bolt?
It is a simple elasticsearch type search engine

----
    endpoint to add document to index
    POST /index
    {
    "id": "1",
    "title": "sample doc",
    "data": "Hello! My name is Bolt."
    }

    endpoint for searching the index
    GET /search?q=name%20bolt
    [
        {
            "id" : "1",
            "title" : "sample doc",
            "data" : "Hello there. My name is Bolt."
        }
    ]

### Running
    npm install
    node app.js
