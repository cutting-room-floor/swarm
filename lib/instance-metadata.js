// ec2 Instance meta-data api calls.
var get = require('get');

var cache = {};

exports.loadId = function(callback) {
    if (cache.id) return callback(null, cache.id);
    (new get('http://169.254.169.254/latest/meta-data/instance-id'))
        .asString(function(err, id) {
            if (err) callback(err);
            cache.id = id;
            callback(null, cache.id);
        });
};

exports.loadAz = function(callback) {
    if (cache.az) return callback(null, cache.az);
    (new get('http://169.254.169.254/latest/meta-data/placement/availability-zone'))
        .asString(function(err, az) {
            if (err) callback(err);
            var match = /^(.+)([a-z]{1})$/.exec(az)
            cache.az = {region: match[1], az: match[2]}
            callback(null, cache.az);
        });
};
