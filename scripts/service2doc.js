const yargs = require('yargs');
const fs = require('fs')

var argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -s services.json -t [md|nodered]')
    .option('services', {
      alias: 's',
      describe: 'Services file'
    })
    .option('register', {
      alias: 'r',
      describe: 'Register file'
    })
    .option('type', {
      alias: 't',
      describe: 'choose the output type',
      choices: ['nodered', 'md']
    })
    .demandOption(['s', 't'])
    .help('h')
    .version(false)
    .argv;

services_json = argv.services;
register_html = argv.register;

// ## Get the label info from ../nodes/victron-nodes.html as well
const searchLabelInfo = (filename) => {
    return new Promise((resolve) => {

        const regEx = new RegExp(/^ *register(In|Out)putNode\('[^,]*', '([^']*)', '([^']*)'\);/, "")
        var result = new Object();

        fs.readFile(filename, 'utf8', function (err, contents) {
            let lines = contents.toString().split("\n");
            lines.forEach(line => {
                if (line && line.search(regEx) >= 0) {
                    var label = line.replace(regEx, '$2');
                    var node = line.replace(regEx, '$3');
                    result[node] = label
                }
            })
            resolve(result);
        })
    });
}

function show(a, text) {
  if ( a === argv.type ) {
    console.log(text)
  }
}

searchLabelInfo(register_html).then(function(labelinfo){
  const input = [];
  const output= [];

  for (const [key, value] of Object.entries(labelinfo)) {
     if (/input-/.test(key) ) {
       input.push('['+value+'](#'+value.replace(/ /g, '-').toLowerCase()+')')
     } else {
       output.push('['+value+' Control](#'+value.replace(/ /g, '-').toLowerCase()+'-control)')
     }
  }

  show('md', 'On this page you find and overview of _all_ possible services and measurements for the available nodes. The edit panel will only show items available in your system.')
  show('md', 'For example a Cerbo CX has 2 relays and thus will show 2 relays to control. An EasySolar-II GX has only one relay and thus will only show one.\n')
  show('md', 'You can find more background information on the paths and how to use them [here](https://github.com/victronenergy/venus/wiki/dbus).\n')
  show('md', '**Input nodes:** '+input.join(', ')+ '  ')
  show('md', '**Ouput nodes:** '+output.join(', ')+ '  ')

  fs.readFile(services_json, 'utf8', (err, jsonString) => {
    if (err) {
        console.log("Error reading file from disk:", err)
        return
    }
    try {
        const services = JSON.parse(jsonString)
        var oc = false;
        show('md', '# Input nodes\n')
        show('md', 'The input nodes have two selectable inputs: the devices select and measurement select. The available options are dynamically updated based on the data that is actually available on the Venus device.\n')
        show('md', '- **Device select** - lists all available devices')
        show('md', '- **Measurement select** - lists all available device-specific measurements')
        show('md', '- **Node label input field** - sets a custom label for the node\n')
        show('md', 'The measurement unit type is shown in the measurement label in brackets, e.g. Battery voltage (V). In case the data type is enumerated, an approppriate enum legend is shown below the selected option.\n')
        show('md', '![input nodes](https://github.com/victronenergy/node-red-contrib-victron/blob/master/documentation/images/edit-vebus-input.png)\n')
        Object.keys(services).forEach(function(k) {
          show('nodered', '<script type="text/x-red" data-help-name="victron-'+k+'">')
          if (/output-/.test(k)) {
            labelinfo[k] += ' Control';
            if ( oc === false) {
              show('md', '# Output nodes\n')
              show('md', 'Output Nodes have the same options available, but the selectable _measurement_ only lists writable services. Additionally, the user can set an initial value to the service, which is sent whenever the flow is deployed.\n')
              show('md', '- **Device select** - lists all available devices')
              show('md', '- **Measurement select** - lists all available device-specific measurements')
              show('md', '- **Initial value input field** - lists all available device-specific measurements')
              show('md', '- **Node label input field** - sets a custom label for the node\n')
              show('md', 'All output nodes should have the control value set in its incoming messages `msg.payload` property.\n')
        show('md', '![output nodes](https://github.com/victronenergy/node-red-contrib-victron/blob/master/documentation/images/edit-vebus-output.png)\n')
            };
            oc = true;
          }
          show('md', '## '+labelinfo[k])
          Object.keys(services[k]).forEach(function(v) {
            if ( v === 'help' ) { 
              show('nodered', services[k].help);
              var mdtext = services[k].help
                             .replace(/<[^b]*b>/g, '**')
                             .replace(/<[^i]*i>/g, '_')
                             .replace(/<[^>]*>/ig, '');
              show('md', '\n'+mdtext+'\n')
              return;
            }
            show('nodered', '<h3>'+v+'</h3>');
            show('nodered', '<dl class="message-properties">');
            Object.keys(services[k][v]).forEach(function(p) {
              show('nodered', '  <dt class="optional">'+services[k][v][p].name+'<span class="property-type">'+services[k][v][p].type+'</dt>');
              show('nodered', '  <dd>Dbus path: <b>'+services[k][v][p].path+'</b>');
              show('md', '**'+services[k][v][p].name + '**, '+'dbus path: `'+services[k][v][p].path+'`, type _'+services[k][v][p].type+'_  ')
              if ( services[k][v][p].type === 'enum' ) {
                show('nodered', "<ul>");
                Object.keys(services[k][v][p].enum).forEach(function(e) {
                   if ( services[k][v][p].enum[e]) {
                     show('nodered', '  <li>'+e+' - '+services[k][v][p].enum[e]+'</li>');
                     show('md', '  - '+e+' - '+services[k][v][p].enum[e]);
                   }
                });
                show('nodered', "</ul>");
                show('md', '\n')
              }
              if (services[k][v][p].remarks) {
                show('nodered', services[k][v][p].remarks)
                show('md', '_'+services[k][v][p].remarks+'_')
              }
              show('nodered', "</dd>");
            });
            show('nodered', '</dl>');
          });
          show('nodered', '</script>\n');
          show('md', '\n');
        })
    } catch(err) {
        console.log('Error parsing JSON string:', err)
    }
  })
})

