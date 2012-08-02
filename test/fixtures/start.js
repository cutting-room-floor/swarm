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
