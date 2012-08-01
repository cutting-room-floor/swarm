process.env.NODE_ENV = 'test';

var server = require('./server.js');

module.exports.before = function(done) {
    server.start(function() {
        done();
    });
}

module.exports.after = function() {
    server.stop();
}

module.exports.swarm = function() {
    return "./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --regions=localhost"
}();
