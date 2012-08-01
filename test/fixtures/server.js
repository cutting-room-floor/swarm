var http = require('http');
var fs = require('fs');

http.createServer(function (request, response) {
    console.log(require('url').parse(request.url, true).query);
    var query = require('url').parse(request.url, true).query;
    if (query.Action == 'DescribeInstances') {
        fs.readFile("DescribeInstancesResult", "binary", function(err, file) {
            if(err) {        
                response.writeHead(500, {"Content-Type": "text/plain"});
                response.write(err + "\n");
                response.end();
                return;
            }
            response.writeHead(200);
            response.write(file, "binary");
            response.end();
        });
    }
    else if (query.Action == 'DescribeTags') {

    }
    //response.writeHead(200, {'Content-Type': 'text/plain'});
    //response.end('Hello World\n');
}).listen(8901);

console.log('Server running at http://127.0.0.1:8901/');
