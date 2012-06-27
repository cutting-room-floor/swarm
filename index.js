#!/usr/bin/env node
// A tool for working with swarms of MapBox servers.

var aws = require('aws-lib');
var Step = require('step');
var _ = require('underscore');
var fs = require('fs');
var get = require('get');
var yamlish = require('yamlish');
var config;
var clients = {};

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
    .describe('awsSecret', 'awsSecret, overrides the value in config file if both are provided.')
    .default('regions', 'us-east-1,us-west-1,us-west-2,eu-west-1,ap-southeast-1,ap-northeast-1,sa-east-1');
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

_(argv.regions.split(',')).each(function(region) {
    clients[region] = aws.createEC2Client(config.awsKey, config.awsSecret, 
      {version: '2012-03-01', host: 'ec2.' + region + '.amazonaws.com'});
});

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
        var hash = {};
        if (instance['PuppetClasses']) hash['classes'] = JSON.parse(instance['PuppetClasses']);
        if (instance['PuppetParameters']) hash['parameters'] = JSON.parse(instance['PuppetParameters']);
        if (instance['PuppetEnvironment']) hash['environment'] = instance['PuppetEnvironment'];
        console.log(yamlish.encode(hash));
    });
};

swarm[command]();

function loadInstances(callback) {
    var instances = [];
    var i;
    // Special filters
    var exclude = ['Class', 'Parameter', 'Environment', 'ClassParameter'];
    Step(
        function() {
            var group = this.group();
            _(clients).each(function(client) {
                client.call('DescribeInstances', {}, group());
            });
        },
        function(err, result) {
        if (result.Errors) return callback(result.Errors.Error.Message);
        _(result).chain()
            .map(function(v, k, list) {
            if (v.reservationSet.item) {
                return v.reservationSet.item;
            }
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
        i = _(instances).chain()
            .filter(function(instance) {
                return instance.tagSet !== undefined;
            })
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
            return this;
        }, 
        function() {
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
        },
          function(err) {
            if (err) throw err;
            _(argv.filter).each(function(v, k) {
                if (_.indexOf(exclude, k) == -1) {
                    i = i.filter(function(instance) {
                        return _(instance[k]).isString() &&
                            instance[k].toLowerCase() === v.toLowerCase();
                    });
                } else {
                    // Handle special filters
                    i = i.filter(function(instance) {
                        switch(k) {
                            case 'Class':
                                if (instance.PuppetClasses) {
                                    return _.has(JSON.parse(instance.PuppetClasses), argv.filter.Class);
                                } else { return false }
                            case 'Parameter':
                                // These are global parameters, not class parameters
                                if (instance.PuppetParameters) { 
                                    return _.has(JSON.parse(instance.PuppetParameters), argv.filter.Parameter);
                                } else { return false }
                            case 'Environment':
                                if (instance.PuppetEnvironment) {
                                    return instance.PuppetEnvironment;
                                } else { return false }
                            case 'ClassParameter':
                                if (instance.PuppetClasses) {
                                    var klass = argv.filter.ClassParameter.split(':')[0];
                                    var param = argv.filter.ClassParameter.split(':')[1];
                                    if (_.has(JSON.parse(instance.PuppetClasses), klass)) {
                                        return _.has(JSON.parse(instance.PuppetClasses)[klass], param)
                                    } else { return false; }
                                } else { return false; }
                            default:
                                return false;
                        }
                    });
                }
            });
            return this;
        },
        function() {
            return callback(null, i.value());
        }
     );

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
