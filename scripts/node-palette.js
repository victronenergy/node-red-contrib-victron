/*
  Creates a json flows file containing all of the available Victron
  Energy nodes.
  Uses the services file as a basis to generate a node-palette flow,
  which is used for making a screenshot for the README.
  usage:
  node vcflows.js -s ../src/services/services.json  > ~/git/node-red-contrib-victron/documentation/node-palette.json

  and then, using curl:
  curl -k -X POST https://192.168.4.66:1881/flow -H 'content-type: application/json' -d @documentation/node-palette.json

  after which you can take your favorite screenshot to to grab the flow.
*/

const fs = require('fs');
const yargs = require('yargs');

var argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -s services.json')
    .option('services', {
      alias: 's',
      describe: 'Services file'
    })
    .demandOption(['s'])
    .help('h')
    .version(false)
    .argv;

services_json = argv.services;
xls_file = argv.excel;

// Read the services.json file
let services = JSON.parse(fs.readFileSync( services_json ));
let output = {
  "id":  "1234567890",
  "label": "Node overview",
  "disabled" : false,
  "info": "Overview of all Victron Energy nodes",
  "nodes": [],
  "configs": []
}

output.nodes.push( { "type": "comment", "name": "Input nodes", "id": output.id+1, "x": 150, "y": 60 })
output.nodes.push( { "type": "comment", "name": "Output nodes", "id": output.id+11, "x": 150, "y": 420 })

var i = 1;
for (const [node, info] of Object.entries(services) ) {
  if ( node.match(/^output-/) && p.match(/^input-/)) {
     i = 37;
  }
  x = 150 + (( i % 4 ) * 220);
  y = 60 + (Math.floor( i / 4 ) * 40 );
  var vcnode = { "type": "victron-"+node, "z": "1234567890", "id": output.id+100+i, "x": x, "y": y}
  output.nodes.push(vcnode);
  p = node;
  i++;
}

console.log(JSON.stringify(output))
