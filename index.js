// A tool for working with swarms of MapBox servers.

var Step = require('step');
var _ = require('underscore');
var fs = require('fs');
var yamlish = require('yamlish');
var instanceMetadata = require('./lib/instance-metadata');
var ec2Api= require('./lib/ec2-api');

var optimist = require('optimist')
    .usage('A tool for working with swarms of MapBox servers.\n' +
           'Usage: $0 <command> [options]\n\n' +
           'Available commands:\n' +
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
if (!command) command = 'metadata';
if (!_(['metadata', 'classify']).include(command)) {
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

var regions = argv.regions.split(',');

if (argv.awsKey) config.awsKey = argv.awsKey;
if (argv.awsSecret) config.awsSecret= argv.awsSecret;

var swarm = {};

swarm.metadata = function() {
    Step(function() {
        ec2Api.loadInstances(ec2Api.createClients(config, regions), argv.filter, this);
    }, function(err, instances) {
        if (err) throw err;
        var possibleAttr = _(instances).chain()
            .map(function(instance) { return _(instance).keys(); })
            .flatten()
            .uniq()
            .value();
        if (instances.length && !_(possibleAttr).include(argv.attribute)) {
            optimist.showHelp();
            console.error('Invalid attribute %s.\n\nAvailable attributes are:\n%s',
                argv.attribute, possibleAttr.join(', '));
            process.exit(1);
        }
        if (!instances.length) console.log("");
        else {
            console.log(_(instances).chain()
                .pluck(argv.attribute)
                .compact()
                .filter(_.isString)
                .uniq()
                .value()
                .join('\n'));
        }
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
        ec2Api.loadInstances(ec2Api.createClients(config, regions), argv.filter, this);
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

// If any supported arguments have the `_self` value we resolve then first, and
// then actually run the command.
Step(function() {
    // --filter.instanceId _self
    if (argv.filter && argv.filter.instanceId == '_self') {
        var next = this;
        instanceMetadata.loadId(function(err, id) {
            if (err) next(err);
            argv.filter.instanceId = id;
            next();
        });
    }
    else { this() }
}, function(err) {
    if (err) throw err;
    // --filter.TAG _self
    var lookup = _(argv.filter).chain().map(function(v, k) {
        if (v == '_self') return k;
    }).compact().value();

    if (!lookup) return this();

    var tagCache;
    var group = this.group();
    _(lookup).each(function(key) {
        var next = group();
        Step(function() {
            instanceMetadata.loadId(this.parallel())
            instanceMetadata.loadAz(this.parallel());
        }, function(err, id, az) {
            if (err) throw (err);
            if (tagCache) return this(null, tagCache);
            var filters = {'resource-type': 'instance', 'resource-id': id};
            ec2Api.loadTags(ec2Api.createClients(config, [az.region]), filters, this);
        }, function(err, tags) {
            if (err) return group(err);
            tagCache = tags;
            argv.filter[key] = _(tags).find(function(v){
               return v.key == key;
            }).value;
            next();
        });
    });

}, function(err) {
    if (err) throw err;
    // --regions _self
    var i = regions.indexOf('_self');
    if (i !== -1) {
        var next = this;
        instanceMetadata.loadAz(function(err, az) {
            if (err) next(err);
            regions[i] = az.region;
            next();
        });
    }
    else { this() }
}, function(err) {
    if (err) throw err;
    swarm[command]();
});
