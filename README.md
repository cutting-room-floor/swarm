SWARM
-----

An EC2 listing and searching utility. Swarm lets you quickly get information about the EC2s you have running and filter based on certain metadata.

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
