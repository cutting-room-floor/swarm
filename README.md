SWARM
-----

An EC2 listing and searching utility. Swam lets you quickly get information about the EC2s you have running and filter based on certain metadata.

## Examples

List running swarms

> node index.js --config config.json list

Get the hostname of all servers in the 'sidcar' swarm

> node index.js --config config.json metadata --swarm sidecar --attribute dnsName

Get hostnames for all tilestream-tile servers in the sidcar swarm.

> node index.js --config config.json metadata --swarm sidecar --attribute dnsName --class tilestream-tiles
