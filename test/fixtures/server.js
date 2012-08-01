var http = require('http');
var fs = require('fs');
var path = require('path');
var qs = require('querystring');

var server;

server = http.createServer(function (request, response) {
    if (request.method == 'POST') {
        var body = '';
        request.on('data', function (data) {
            body += data;
        });
        request.on('end', function () {
            var POST = qs.parse(body);
            if (POST.Action == 'DescribeInstances') {
                fs.readFile(path.join(__dirname, "DescribeInstancesResultXML"), "binary", function(err, file) {
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
                console.log('todo');
            }
        });
    }
});

module.exports.start = function(done) {
    server.listen(8901, function() {
        console.log('Fake API server started');
        done();
    });
}

module.exports.stop = function() {
    server.close();
}
