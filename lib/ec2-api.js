// ec2 API calls.
var aws = require('aws-lib');
var Step = require('step');
var _ = require('underscore');

// Generates aws api clients for use by other methods.
exports.createClients = function(config, regions) {
    var clients = {};
    _(regions).each(function(region) {
        clients[region] = aws.createEC2Client(config.awsKey, config.awsSecret, 
          {version: '2012-03-01', host: 'ec2.' + region + '.amazonaws.com'});
    });
    return clients;
}

// Loads instances and optionally filters them.
exports.loadInstances = function(clients, filters, callback) {
    Step(function() {
        var group = this.group();
        _(clients).each(function(client) {
            client.call('DescribeInstances', {}, group());
        });
    },
    function(err, result) {
        if (err) throw err;

        var instances = [];
        _(result).chain()
            .map(function(v, k, list) {
                if (v.reservationSet.item) return v.reservationSet.item;
            })
            .compact()
            .flatten()
            .pluck('instancesSet')
            .pluck('item')
            .each(function(item) {
                if (_.isArray(item)) {
                    Array.prototype.push.apply(instances, item)
                }
                else {
                    instances.push(item);
                }
            });

        var i = _(instances).chain()
            .filter(function(instance) {
                return instance.tagSet !== undefined;
            })
            .map(function(instance) {
                _(instance.tagSet.item).each(function(tag) {
                    instance[tag.key] = tag.value;
                });
                instance.State = instance.instanceState.name;
                return instance;
            })
            .map(function(instance) {
                var i = {};
                _(instance).each(function(v, k) {
                    if (_(v).isString()) {
                        i[k] = v;
                    }
                });
                return i;
            });

        _(filters).each(function(v, k) {
            i = i.filter(function(instance) {
                return _(instance[k]).isString() &&
                    instance[k].toLowerCase() === v.toLowerCase();
            });
        });

        return callback(null, i.value());
    });
};

exports.loadTags = function(clients, filters, callback) {
    var i = 1;
    var params = {};
    _(filters).each(function(v, k) {
        params['Filter.' + i + '.Name'] = k;
        params['Filter.' + i + '.Value'] = v;
        i++;
    });
    Step(function() {
        var group = this.group();
        _(clients).each(function(client) {
            client.call('DescribeTags', _(params).clone(), group());
        });
    },
    function(err, result) {
        if (err) throw err;

        var tags =  _(result).chain()
            .map(function(v, k) { if (v.tagSet) return v.tagSet.item })
            .flatten()
            .compact()
            .value()

        callback(null, tags);
    });
};
