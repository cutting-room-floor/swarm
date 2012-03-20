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
    .describe('swarm', 'The swarm to query. Optional for the metadata command.')
    .describe('self', 'Query the swarm that the current instances belongs to. Optional for the metadata command.')
    .describe('class', 'The class of instances to query. Optional for the metadata command.')
    .describe('attribute', 'The EC2 API instance attribute to load from the swarm. Required for the metadata command.')
    .describe('hostname', 'Private hostname of and EC2. Required for the classify command and optional for the metadata command.')
    .demand('config');
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

if (command === 'classify' && !argv.hostname) {
    optimist.showHelp();
    console.error('Missing --hostname option required for %s command.', command);
    process.exit(1);
}

if (command === 'metadata' && !argv.attribute) {
    optimist.showHelp();
    console.error('Missing --attribute option required for %s command.', command);
    process.exit(1);
}

try {
    var config = JSON.parse(fs.readFileSync(argv.config, 'utf8'));
} catch(e) {
    console.warn('Invalid JSON config file: ' + argv.config);
    throw e;
}

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
        loadInstances(this.parallel());
        // TODO Eliminate
        loadTags(this.parallel());
    }, function(err, instances, tags) {
        if (err) throw err;
        if (argv.self) {
            loadInstanceId(function(err, instanceId) {
                var swarmFilter = _(tags).chain().filter(function(tag) {
                    return tag.key === 'Swarm' && tag.resourceId === instanceId;
                }).first().value().value;
                this(null, instances, tags, swarmFilter);
            }.bind(this));
        } else {
            this(null, instances, tags, argv.swarm);
        }
    }, function(err, instances, tags, swarmFilter) {
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

        if (argv.hostname) {
            var instances = _(instances).chain()
                .filter(function(instance) {
                    return _(instance.privateDnsName).isString() &&
                        instance.privateDnsName.toLowerCase() === argv.hostname.toLowerCase();
                })
                .value();
        }

        if (swarmFilter) {
            var ids = _(tags).chain().filter(function(tag) {
                return tag.key === 'Swarm' && tag.value === swarmFilter;
            }).pluck('resourceId').value();
            var instances = _(instances).filter(function(instance) {
                return _(ids).contains(instance.instanceId);
            });
        }

        if (argv.class) {
            var ids = _(tags).chain().filter(function(tag) {
                return tag.key === 'Class' && tag.value === argv.class;
            }).pluck('resourceId').value();
            var instances = _(instances).filter(function(instance) {
                return _(ids).contains(instance.instanceId);
            });
        }
        console.log(_(instances).chain().pluck(argv.attribute).compact().value().join('\n'));
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
        loadInstances(this.parallel());
        loadTags(this.parallel());
    }, function(err, instances, tags) {
        if (err) throw err;
        var instance = _(instances).chain()
            .filter(function(instance) {
                return _(instance.privateDnsName).isString() &&
                    instance.privateDnsName.toLowerCase() === argv.hostname.toLowerCase();
            })
            .first().value();
        var tags = _(tags).chain()
            .filter(function(tag) {
                return tag.resourceId === instance.instanceId;
            })
            .value();

        var grouped = _(tags).groupBy(function(tag) {
            return tag.key;
        });
        var classes = _(tags).chain().map(function(tag) {
            if (tag.key === 'Class')
                return '  - ' + tag.value;
            if (tag.key === 'Supernode' && tag.value === 'true')
                return '  - ' + grouped.Class[0].value + '::supernode';
        }).compact().value();

        // Output YAML.
        console.log('classes:');
        console.log(classes.join('\n'));
    });
};

swarm[command]();

function loadInstances(callback) {
    ec2.call('DescribeInstances', {}, function(result) {
        if (result.Errors) return callback(result.Errors.Error.Message);
        var instances = _(result.reservationSet.item).chain()
            .pluck('instancesSet')
            .pluck('item')
            .map(function(instance) {
                _(instance.tagSet.item).each(function(tag) {
                    instance[tag.key] = tag.value;
                });
                return instance;
            })
            .value();
        callback(null, instances);
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
