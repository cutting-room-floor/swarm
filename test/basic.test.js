var assert = require('assert');
var _ = require('underscore');
var start = require('./fixtures/start');
var exec = require('child_process').exec;

before(function(done) {
    start.before(function() {
        done();
    });
});

after(start.after);

// 1. Swarm of i-33333333 is sharks

describe('Array', function(){
  describe('#indexOf()', function(){
    it('should return sharks', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute privateDnsName --filter.instanceId i-00000000',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.strictEqual(stdout.replace(/\n/g, ""), 'domU-12-30-38-03-7D-67.compute-1.internal');
            done();
        });
    })
  })

  describe('bar', function(){
    it('should return bar', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute privateDnsName --filter.instanceId _self',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.strictEqual(stdout.replace(/\n/g, ""), 'domU-12-30-38-03-7D-67.compute-1.internal');
            done();
        });
    })
  })
  describe('baz', function(){
    it('should return baz', function(done){
        exec('./bin/swarm --awsKey=foo --awsSecret=bar --port=8901 \
          --regions=localhost --metadataHost=localhost:8901 metadata \
          --attribute privateDnsName --filter.Swarm _self',
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.deepEqual(_(stdout.split("\n")).compact(),
            ['domU-12-30-39-06-88-B6.compute-1.internal','domU-12-30-39-02-44-43.compute-1.internal',
             'ip-10-65-185-140.ec2.internal','ip-10-118-22-28.ec2.internal']);
            done();
        });
    })
  })

})



