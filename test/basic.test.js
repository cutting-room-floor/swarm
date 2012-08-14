var assert = require('assert');
var _ = require('underscore');
var start = require('./fixtures/start');
var exec = require('child_process').exec;

// Start the mock API server
before(function(done) {
    start.before(function() {
        done();
    });
});

// Stop the mock API server
after(start.after);

describe('Basic tests', function(){
  describe('Get privateDnsName, filter by specific instanceId', function(){
    it('should return domU-12-30-38-03-7D-67.compute-1.internal', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute privateDnsName --filter.instanceId i-00000000',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.strictEqual(stdout.replace(/\n/g, ""), 'domU-12-30-38-03-7D-67.compute-1.internal');
            done();
        });
    });
  });
  describe('Get privateDnsName, filter by instanceId of _self', function(){
    it('should return domU-12-30-38-03-7D-67.compute-1.internal', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute privateDnsName --filter.instanceId _self',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.strictEqual(stdout.replace(/\n/g, ""), 'domU-12-30-38-03-7D-67.compute-1.internal');
            done();
        });
    });
  });
  describe('Get privateDnsName of all instances in "fish" swarm, filter by Swarm _self', function(){
    it('should return array of four instances', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute privateDnsName --filter.Swarm _self',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.deepEqual(_(stdout.split("\n")).compact(),
            ['domU-12-30-38-03-7D-67.compute-1.internal','domU-12-30-39-06-88-B6.compute-1.internal','domU-12-30-39-02-44-43.compute-1.internal',
             'ip-10-65-185-140.ec2.internal','ip-10-118-22-28.ec2.internal']);
            done();
        });
    });
  });
  describe('Get privateDnsName of all instances in "fish" swarm, filter by Swarm fish', function(){
    it('should return array of four instances', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute privateDnsName --filter.Swarm fish',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.deepEqual(_(stdout.split("\n")).compact(),
            ['domU-12-30-38-03-7D-67.compute-1.internal','domU-12-30-39-06-88-B6.compute-1.internal','domU-12-30-39-02-44-43.compute-1.internal',
             'ip-10-65-185-140.ec2.internal','ip-10-118-22-28.ec2.internal']);
            done();
        });
    });
  });
  describe('Get privateDnsName of fish production puppetmaster', function(){
    it('should return ip-10-118-22-28.ec2.internal', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute privateDnsName --filter.Swarm fish --filter.Class puppetmaster',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.strictEqual(stdout.replace(/\n/g, ""), 'ip-10-118-22-28.ec2.internal');
            done();
        });
    });
  });
  describe('Get instanceId of fish supernode', function(){
    it('should return i-00000000', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute instanceId --filter.Swarm fish --filter.ClassParameter database-server:supernode',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.strictEqual(stdout.replace(/\n/g, ""), 'i-00000000');
            done();
        });
    });
  });
  describe('Get instanceId of production servers', function(){
    it('should return five instances', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute instanceId --filter.Environment production',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.deepEqual(_(stdout.split("\n")).compact(),
            ['i-00000002','i-00000003','i-00000004','i-00000005']);
            done();
        });
    });
  });
  describe('List all swarms', function(){
    it('should return the name of two swarms', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 list',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.deepEqual(_(stdout.split("\n")).compact(),
            ['fish','dogs']);
            done();
        });
    });
  });
  describe('Classify an instance', function(){
    it('should return Puppet ENC classification', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 --secure=false \
          --regions=localhost --metadataHost=localhost:8901 classify \
          --filter.privateDnsName=domU-12-30-38-03-7D-67.compute-1.internal',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.strictEqual(stdout.replace(/(\n|\s)/g, ""),
              'classes:"database-server":supernode:truebackups:trueenvironment:development');
            done();
        });
    });
  });

});
