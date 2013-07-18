SWARM
-----

An EC2 listing and searching utility. Swarm lets you quickly get information about the EC2s you have running and filter based on certain metadata.

## Typical Usage

Swarm is mostly a server-side script used as parts of bash scripts, rather than a CLI tool
for devs. We use it for self-selecting masters and certain kinds of replication.

## Examples

List running swarms

    node index.js --config config.json list

Swarm supports [EC2 tags](http://docs.amazonwebservices.com/AWSEC2/latest/UserGuide/Using_Tags.html)
as filters and output. The examples below assume you have tagged some EC2
instances with `Swarm` tag.

Get the hostname of instances with the `Swarm` tag set to `production`:

    node index.js --config config.json metadata --attribute dnsName --filter.Swarm production

Output the cluster name for instance `i-5h39fjk`:

    node index.js --config config.json metadata --attribute Swarm --filter.instanceId i-5h39fjk

If you run the command from an EC2 instance, you can swap `_self` in for an actual Swarm name
and the Swarm of the current instance will be used.

Get the hostname of all instances in my Swarm.

    node index.js --config config.json metadata --attribute dnsName --filter.Swarm _self

You can use multiple filters at once. This will list the hostanme for all database servers in the staging swarm.

    node index.js --config config.json metadata --attribute dnsName --filter.Swarm staging --filter.Class database-server

## Puppet ENC spec

Swarm implements four special filters:

* Class - corresponds to the ec2 tag PuppetClasses.
* Parameter - corresponds to the ec2 tag PuppetParameters
* Environment - corresponds to the ec2 tag PuppetEnvironment
* ClassParameter - does not correspond to any ec2 tag; is a meta parameter. See below.

which correspond to [the Puppet ENC spec](http://docs.puppetlabs.com/guides/external_nodes.html#enc-output-format).

The following special ec2 tags which correspond to the special --filter(s) mentioned above should have the following format:

### PuppetClasses

A JSON object, such as

```json
{"common":null,"puppet":null,"ntp":{"ntpserver":"0.pool.ntp.org"},"aptsetup":{"additional_apt_repos":["deb localrepo.example.com/ubuntu lucid production","deb localrepo.example.com/ubuntu lucid vendor"]}}
```

### PuppetParameters

A JSON object, such as

```json
{"ntp_servers":["0.pool.ntp.org","ntp.example.com"],"mail_server":"mail.example.com","iburst":true}
```

### PuppetEnvironment

A string, such as

    production 

### Filter with special filters and ec2 tags

Filter your ec2's using Swarm with commands like:

    node index.js --config config.json metadata --attribute dnsName --filter.Class ntp

    node index.js --config config.json metadata --attribute dnsName --filter.ClassParameter ntp:ntp_server

    node index.js --config config.json metadata --attribute dnsName --filter.Parameter ntp_servers
    
    node index.js --config config.json metadata --attribute dnsName --filter.Environment production

Notice the ClassParameter filter is a class name and a parameter on that class separated by a colon.  At present, swarm does not check the value of a paramter or class parameter, but instead filters based on whether or not that paramter or class paramter exists at all.

