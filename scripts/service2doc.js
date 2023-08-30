const fs = require('fs')
const _ = require('lodash')

const argv = require('yargs/yargs')(process.argv.slice(2))
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
  .argv

const servicesJSON = argv.services
const registerHTML = argv.register

// ## Get the label info from ../nodes/victron-nodes.html as well
const searchLabelInfo = (filename) => {
  return new Promise((resolve) => {
    const regEx = /^ *register(In|Out)putNode\('[^,]*', '([^']*)', '([^']*)'\);/
    const result = {}

    fs.readFile(filename, 'utf8', function (err, contents) {
      if (err) {
        console.log(err.stack)
      }
      const lines = contents.toString().split('\n')
      lines.forEach(line => {
        if (line && line.search(regEx) >= 0) {
          const label = line.replace(regEx, '$2')
          const node = line.replace(regEx, '$3')
          result[node] = label
        }
      })
      resolve(result)
    })
  })
}

function show (a, text) {
  if (a === argv.type) {
    console.log(text)
  }
}

searchLabelInfo(registerHTML).then(function (labelinfo) {
  const input = []
  const output = []

  for (const [key, value] of Object.entries(labelinfo)) {
    if (/input-/.test(key)) {
      input.push('[' + value + '](#' + value.replace(/ /g, '-').toLowerCase() + ')')
    } else {
      output.push('[' + value + ' Control](#' + value.replace(/ /g, '-').toLowerCase() + '-control)')
    }
  }

  show('md', 'On this page you find and overview of _all_ possible services and measurements for the available nodes. The edit panel will only show items available in your system.')
  show('md', 'For example a Cerbo CX has 2 relays and thus will show 2 relays to control. An EasySolar-II GX has only one relay and thus will only show one.\n')
  show('md', 'You can find more background information on the paths and how to use them [here](https://github.com/victronenergy/venus/wiki/dbus).\n')
  show('md', '**Input nodes:** ' + input.join(', ') + '  ')
  show('md', '**Ouput nodes:** ' + output.join(', ') + '  ')
  show('md', "If there are services and paths not covered by the above nodes, there are also 2 [custom nodes](#custom-nodes) that allow you to read from and write to all found dbus services and paths.")

  fs.readFile(servicesJSON, 'utf8', (err, jsonString) => {
    if (err) {
      console.log('Error reading file from disk:', err)
      return
    }
    try {
      const services = JSON.parse(jsonString)
      let oc = false
      show('md', '# Input nodes\n')
      show('md', 'The input nodes have two selectable inputs: the devices select and measurement select. The available options are dynamically updated based on the data that is actually available on the Venus device.\n')
      show('md', '- **Device select** - lists all available devices')
      show('md', '- **Measurement select** - lists all available device-specific measurements')
      show('md', '- **Node label input field** - sets a custom label for the node\n')
      show('md', 'The measurement unit type is shown in the measurement label in brackets, e.g. Battery voltage (V). In case the data type is enumerated, an approppriate enum legend is shown below the selected option.\n')
      show('md', 'If the data type is _float_, a dropdown for rounding the output appears.\n')
      show('md', 'By default the node outputs its value every five seconds. If the only changes is checked, the node will only output on value changes.\n')
      show('md', '![input nodes](https://github.com/victronenergy/node-red-contrib-victron/blob/master/documentation/images/edit-vebus-input.png)\n')
      Object.keys(services).forEach(function (k) {
        show('nodered', '<script type="text/x-red" data-help-name="victron-' + k + '">')
        if (/output-/.test(k)) {
          labelinfo[k] += ' Control'
          if (oc === false) {
            show('md', '# Output nodes\n')
            show('md', 'Output nodes have the same options available as input nodes, but the selectable _measurement_ only lists writable services. Additionally, the user can set an initial value to the service, which is sent whenever the flow is deployed.\n')
            show('md', '- **Device select** - lists all available devices')
            show('md', '- **Measurement select** - lists all available device-specific measurements')
            show('md', '- **Initial value input field** - lists all available device-specific measurements')
            show('md', '- **Node label input field** - sets a custom label for the node\n')
            show('md', 'All output nodes should have the control value set in its incoming messages `msg.payload` property.\n')
            show('md', '![output nodes](https://github.com/victronenergy/node-red-contrib-victron/blob/master/documentation/images/edit-relay-output.png)\n')
          };
          oc = true
        }
        show('md', '## ' + labelinfo[k])
        show('nodered', '<h3>Details</h3>')
        if (/input-/.test(k)) {
          show('nodered', '<p>The <strong>input nodes</strong> have two selectable inputs: the devices select and measurement select. The available options are dynamically updated based on the data that is actually available on the Venus device.</p> <ul> <li><em>Device select</em> - lists all available devices</li> <li><em>Measurement select</em> - lists all available device-specific measurements</li> <li><em>Node label input field</em> - sets a custom label for the node</li> </ul> <p>The measurement unit type is shown in the measurement label in brackets, e.g. Battery voltage (V). In case the data type is enumerated, an approppriate enum legend is shown below the selected option.</p>')
          show('nodered', '<p>If the data type is <em>float</em>, a dropdown for rounding the output appears.</p>')
          show('nodered', '<p>By default the node outputs its value every five seconds. If the <em>only changes</em> is checked, the node will only output on value changes.</p>')
        } else {
          show('nodered', '<p><strong>Output nodes</strong> have the same options available as input nodes, but the selectable measurement only lists writable services. Additionally, the user can set an initial value to the service, which is sent whenever the flow is deployed.</p> <ul> <li><em>Device select</em> - lists all available devices</li> <li><em>Measurement select</em> - lists all available device-specific measurements</li> <li><em>Initial value input field</em> - lists all available device-specific measurements</li> <li><em>Node label input field</em> - sets a custom label for the node</li> </ul> <p>All output nodes should have the control value set in its incoming messages <code>msg.payload</code> property.</p> ')
        }

        Object.keys(services[k]).forEach(function (v) {
          if (v === 'help') {
            show('nodered', services[k].help)
            const mdtext = services[k].help
              .replace(/<[^b]*b>/g, '**')
              .replace(/<[^i]*i>/g, '_')
              .replace(/<[^>]*>/ig, '')
            show('md', '\n' + mdtext + '\n')
            return
          }
          show('nodered', '<h3>' + _.capitalize(v) + '</h3>')
          show('nodered', '<dl class="message-properties">')
          Object.keys(services[k][v]).forEach(function (p) {
            show('nodered', '  <dt class="optional">' + services[k][v][p].name + '<span class="property-type">' + services[k][v][p].type + '</dt>')
            show('nodered', '  <dd>Dbus path: <b>' + services[k][v][p].path + '</b>')
            show('md', '**' + services[k][v][p].name + '**, ' + 'dbus path: `' + services[k][v][p].path + '`, type _' + services[k][v][p].type + '_  ')
            if (services[k][v][p].type === 'enum') {
              show('nodered', '<ul>')
              Object.keys(services[k][v][p].enum).forEach(function (e) {
                if (services[k][v][p].enum[e]) {
                  show('nodered', '  <li>' + e + ' - ' + services[k][v][p].enum[e] + '</li>')
                  show('md', '  - ' + e + ' - ' + services[k][v][p].enum[e])
                }
              })
              show('nodered', '</ul>')
              show('md', '\n')
            }
            if (services[k][v][p].remarks) {
              show('nodered', services[k][v][p].remarks)
              show('md', '_' + services[k][v][p].remarks + '_')
            }
            show('nodered', '</dd>')
          })
          show('nodered', '</dl>')
        })
        show('nodered', '</script>\n')
        show('md', '\n')
     })
     show('md', '# Custom nodes')
     show('md', 'The custom nodes also have 2 selectable inputs: the (dbus) service and the (dbus) path.')
     show('md', 'This obviously comes with a risk, as not all services and paths are supposed to be written to. So only use the custom output node if you have read the documentation and know what you are doing. Also note that used services and paths might change, so there is no guarantee that a node will remain functional after a Venus firmware update.')

    } catch (err) {
      console.log('Error parsing JSON string:', err)
    }
  })

})
