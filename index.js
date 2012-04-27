#!/usr/bin/env node
// A tool for working with swarms of MapBox servers.

var aws = require('aws-lib');
var Step = require('step');
var _ = require('underscore');
var fs = require('fs');
var get = require('get');
var config;
var ec2;

var optimist = require('optimist')
    .usage('A tool for working with swarms of MapBox servers.\n' +
           'Usage: $0 <command> [options]\n\n' +
           'Available commands:\n' +
           '  list: list active swarms\n' +
           '  metadata: load given attribute from EC2 API\n' +
           '  classify: return list of puppet classes in YAML format suitable for use with puppet\'s ENC feature')
    .describe('config', 'Path to JSON configuration file that contains awsKey and awsSecret.')
    .describe('attribute', 'The EC2 API instance attribute to load from the swarm. Required for the metadata command.')
    .describe('filter', 'Applies a filter to results based on EC2 instance attributes and tags. Use `filter.<attributeName>`. Multiple filters are applied with the AND operator. Required for the classify command and optional for the metadata command.')
    .describe('awsKey', 'awsKey, overrides the value in gconfig file if both are provided.')
    .describe('awsSecret', 'awsSecret, overrides the value in config file if both are provided.');
var argv = optimist.argv;

if (argv.help) {
    optimist.showHelp(console.log);
    process.exit(0);
}

var command = argv._[0];
if (!command) command = 'list';
if (!_(['list', 'metadata', 'classify']).include(command)) {
    optimist.showHelp();
    console.error('Invalid command %s.', command);
    process.exit(1);
}

if (command === 'classify' && !argv.filter) {
    optimist.showHelp();
    console.error('Missing --filter option required for %s command.', command);
    process.exit(1);
}

if (command === 'metadata' && !argv.attribute) {
    optimist.showHelp();
    console.error('Missing --attribute option required for %s command.', command);
    process.exit(1);
}

var config = {};
if (argv.config) {
    try {
        config = JSON.parse(fs.readFileSync(argv.config, 'utf8'));
    } catch(e) {
        console.warn('Invalid JSON config file: ' + argv.config);
        throw e;
    }
}

if (argv.awsKey) config.awsKey = argv.awsKey;
if (argv.awsSecret) config.awsSecret= argv.awsSecret;

if (!config.awsKey || !config.awsSecret) {
    console.error('Missing awsKey and/or awsSecret in config file.')
    process.exit(1);
}

// TODO: Determine how to support multiple AWS regions.
var ec2 = aws.createEC2Client(config.awsKey, config.awsSecret, {version: '2012-03-01'});

var swarm = {};

// List
swarm.list = function() {
    Step(function() {
        loadTags(this);
    }, function(err, tags) {
        if (err) throw err;
        var swarms = _(tags).chain()
            .filter(function(tag) { return tag.key === 'Swarm' })
            .pluck('value')
            .uniq().value();
        console.log(swarms.join('\n'));
    });
};

swarm.metadata = function() {
    Step(function() {
        loadInstances(this);
    }, function(err, instances) {
        if (err) throw err;
        var possibleAttr = _(instances).chain()
            .map(function(instance) { return _(instance).keys(); })
            .flatten()
            .uniq()
            .value();
        if (!_(possibleAttr).include(argv.attribute)) {
            optimist.showHelp();
            console.error('Invalid attribute %s.\n\nAvailable attributes are:\n%s',
                argv.attribute, possibleAttr.join(', '));
            process.exit(1);
        }

        console.log(_(instances).chain()
            .pluck(argv.attribute)
            .compact()
            .filter(_.isString)
            .value()
            .join('\n'));
    });

}

// ENC Interface for Puppet and EC2 Tags
//
// Accepts an EC2 private hostname as an argument. Looks up the tags
// on the EC2 instance and outputs puppet classes as YAML.
//
// See puppet docs on ENC:
// http://docs.puppetlabs.com/guides/external_nodes.html
//
swarm.classify = function() {
    Step(function() {
        loadInstances(this);
    }, function(err, instances) {
        if (err) throw err;
        var instance = _(instances).first();
        var classes = [];
        if (instance.Class) classes.push('  - ' + instance.Class);
        if (instance.Class && instance.Supernode) classes.push('  - ' + instance.Class + '::supernode');

        // Output YAML.
        console.log('classes:');
        console.log(classes.join('\n'));
    });
};

swarm[command]();

function loadInstances(callback) {
    ec2.call('DescribeInstances', {}, function(result) {
        if (result.Errors) return callback(result.Errors.Error.Message);
        var i = _(result.reservationSet.item).chain()
            .pluck('instancesSet')
            .pluck('item')
            .map(function(instance) {
                _(instance.tagSet.item).each(function(tag) {
                    instance[tag.key] = tag.value;
                });
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

        Step(function() {
            if (argv.filter && argv.filter.Swarm === '_self') {
                loadInstanceId(function(err, instanceId) {
                    if (err) throw err;
                    argv.filter.Swarm = i.filter(function(instance) {
                        return instance.instanceId === instanceId;
                    }).pluck('Swarm').compact().first().value();
                    this();
                }.bind(this));
            } else {
                this();
            }
        }, function(err, instance) {
            if (err) throw err;
            _(argv.filter).each(function(v, k) {
                i = i.filter(function(instance) {
                    return _(instance[k]).isString() &&
                        instance[k].toLowerCase() === v.toLowerCase();
                });
            });

            callback(null, i.value());
        });

    });
};

function loadTags(callback) {
    ec2.call('DescribeTags', {
        'Filter.1.Name': 'resource-type',
        'Filter.1.Value': 'instance'
    }, function(result) {
        if (result.Errors) return callback(result.Errors.Error.Message);
        var tags = result.tagSet.item instanceof Array ?
            result.tagSet.item : [result.tagSet.item];
        callback(null, tags);
    });
};

function loadInstanceId(callback) {
    (new get('http://169.254.169.254/latest/meta-data/instance-id')).asString(callback);
}
