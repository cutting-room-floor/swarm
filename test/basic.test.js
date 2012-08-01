var assert = require('assert');
var start = require('./fixtures/start');
var swarm = start.swarm;
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
      swarm += ' metadata --attribute privateDnsName --filter.instanceId i-5b23e031';
      console.log(swarm);
      exec(swarm,
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }
            assert.strictEqual(stdout.replace(/\n/g, ""), 'domU-12-31-38-04-7D-68.compute-1.internal');
            done();
        });
      
    })
  })
})
