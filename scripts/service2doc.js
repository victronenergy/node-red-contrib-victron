#!/usr/bin/env node
'use strict'

const fs = require('fs')
const _ = require('lodash')
const path = require('path')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 -s services.json -o [md|nodered]')
  .option('services', {
    alias: 's',
    describe: 'Services JSON file path',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: 'Output format',
    choices: ['md', 'nodered'],
    default: 'md'
  })
  .help('h')
  .version(false)
  .argv

// Helper function to output based on format
function output(text) {
  console.log(text)
}

// Helper function to get node name from service name
function getNodeName(service, isOutput) {
  return `victron-${isOutput ? 'output' : 'input'}-${service}`
}

// Helper function to get display name for node
function getDisplayName(service, isOutput) {
  // Convert camelCase or hyphenated names to Title Case
  const baseName = service
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())

  return isOutput ? `${baseName} Control` : baseName
}

// Helper function to filter paths based on node type
function filterPathsByMode(paths, isOutput) {
  return Object.entries(paths).reduce((result, [key, pathObj]) => {
    // Check if path should be included based on mode
    const includeForMode = 
      !pathObj.mode || // No mode specified - include by default
      pathObj.mode === 'both' || // Both input and output
      (isOutput && pathObj.mode === 'output') || // Output node and output mode
      (!isOutput && pathObj.mode === 'input'); // Input node and input mode

    if (includeForMode) {
      result[key] = pathObj
    }

    return result
  }, {})
}

// Helper function to format a path for documentation
function formatPath(pathObj, format) {
  if (!pathObj) return ''

  if (format === 'md') {
    let output = `**${pathObj.name}**, dbus path: \`${pathObj.path}\`, type _${pathObj.type}_`

    if (pathObj.mode) {
      output += ` (Mode: _${pathObj.mode}_)`
    }

    output += '  '

    if (pathObj.type === 'enum' && pathObj.enum) {
      output += '\n'
      for (const [key, value] of Object.entries(pathObj.enum)) {
        if (value) {
          output += `  - ${key} - ${value}\n`
        }
      }
    }

    if (pathObj.remarks) {
      output += `\n_${pathObj.remarks}_\n`
    }

    return output
  } else if (format === 'nodered') {
    let output = `  <dt class="optional">${pathObj.name}<span class="property-type">${pathObj.type}</span></dt>\n`
    output += `  <dd>Dbus path: <b>${pathObj.path}</b>`

    if (pathObj.mode) {
      output += ` <span class="property-mode">(Mode: ${pathObj.mode})</span>`
    }

    if (pathObj.type === 'enum' && pathObj.enum) {
      output += '\n<ul>\n'
      for (const [key, value] of Object.entries(pathObj.enum)) {
        if (value) {
          output += `  <li>${key} - ${value}</li>\n`
        }
      }
      output += '</ul>\n'
    }

    if (pathObj.remarks) {
      output += pathObj.remarks
    }

    output += '</dd>\n'

    return output
  }

  return ''
}

// Helper function to format help text
function formatHelp(help, isOutput, format) {
  if (!help) return ''

  let helpText = ''

  if (typeof help === 'object') {
    // Combine appropriate sections
    if (help.both) {
      helpText += help.both
    }

    if (isOutput && help.output) {
      helpText += help.output
    } else if (!isOutput && help.input) {
      helpText += help.input
    }
  } else {
    helpText = help
  }

  if (format === 'md') {
    return helpText
      .replace(/<[^b]*b>/g, '**')
      .replace(/<[^i]*i>/g, '_')
      .replace(/<[^>]*>/ig, '')
  }

  return helpText
}

// Main function to generate documentation
async function generateDocs() {
  try {
    // Read services.json
    const servicesData = fs.readFileSync(argv.services, 'utf8')
    const services = JSON.parse(servicesData)

    // Generate input and output node lists
    const inputNodes = []
    const outputNodes = []

    // First pass: identify which services have input and output paths
    for (const [serviceName, serviceData] of Object.entries(services)) {
      // Skip metadata entries
      if (serviceName.startsWith('_')) continue

      // Check if this service has any help information
      const hasHelp = serviceData.help !== undefined

      // Check if service has any output-compatible paths
      let hasOutputPaths = false

      for (const categoryName in serviceData) {
        if (categoryName === 'help') continue

        const categoryPaths = serviceData[categoryName]
        for (const pathKey in categoryPaths) {
          const pathObj = categoryPaths[pathKey]
          const pathMode = pathObj.mode || ''

          if (pathMode === 'output' || pathMode === 'both') {
            hasOutputPaths = true
            break
          }
        }

        if (hasOutputPaths) break
      }

      // Always add input node
      const inputDisplayName = getDisplayName(serviceName, false)
      inputNodes.push({
        service: serviceName,
        displayName: inputDisplayName,
        anchor: inputDisplayName.replace(/ /g, '-').toLowerCase()
      })

      // Add output node if applicable
      if (hasOutputPaths) {
        const outputDisplayName = getDisplayName(serviceName, true)
        outputNodes.push({
          service: serviceName,
          displayName: outputDisplayName,
          anchor: outputDisplayName.replace(/ /g, '-').toLowerCase()
        })
      }
    }

    // Generate index
    if (argv.output === 'md') {
      output('On this page you find an overview of _all_ possible services and measurements for the available nodes. The edit panel will only show items available in your system.')
      output('For example a Cerbo CX has 2 relays and thus will show 2 relays to control. An EasySolar-II GX has only one relay and thus will only show one.\n')
      output('You can find more background information on the paths and how to use them [here](https://github.com/victronenergy/venus/wiki/dbus).\n')
      output('**Input nodes:** ' + inputNodes.map(n => `[${n.displayName}](#${n.anchor})`).join(', ') + '  ')
      output('**Output nodes:** ' + outputNodes.map(n => `[${n.displayName}](#${n.anchor})`).join(', ') + '  ')
      output('If there are services and paths not covered by the above nodes, there are also 2 [custom nodes](#custom-nodes) that allow you to read from and write to all found dbus services and paths.')
    }

    // Generate input nodes section
    if (argv.output === 'md') {
      output('\n# Input nodes\n')
      output('The input nodes have two selectable inputs: the devices select and measurement select. The available options are dynamically updated based on the data that is actually available on the Venus device.\n')
      output('- **Device select** - lists all available devices')
      output('- **Measurement select** - lists all available device-specific measurements')
      output('- **Node label input field** - sets a custom label for the node\n')
      output('The measurement unit type is shown in the measurement label in brackets, e.g. Battery voltage (V). In case the data type is enumerated, an appropriate enum legend is shown below the selected option.\n')
      output('If the data type is _float_, a dropdown for rounding the output appears.\n')
      output('By default the node outputs its value every five seconds. If the only changes is checked, the node will only output on value changes.\n')
      output('In case of an enumerated type, the textual value of the payload is also send out as `msg.textvalue`.')
      output('![input nodes](https://github.com/victronenergy/node-red-contrib-victron/blob/master/documentation/images/edit-vebus-input.png)\n')
    }

    // Generate each input node documentation
    for (const node of inputNodes) {
      const serviceName = node.service
      const serviceData = services[serviceName]

      if (argv.output === 'nodered') {
        const nodeName = getNodeName(serviceName, false)
        output(`<script type="text/x-red" data-help-name="${nodeName}">`)
        output('<h3>Details</h3>')
        output('<p>The <strong>input nodes</strong> have two selectable inputs: the devices select and measurement select. The available options are dynamically updated based on the data that is actually available on the Venus device.</p> <ul> <li><em>Device select</em> - lists all available devices</li> <li><em>Measurement select</em> - lists all available device-specific measurements</li> <li><em>Node label input field</em> - sets a custom label for the node</li> </ul> <p>The measurement unit type is shown in the measurement label in brackets, e.g. Battery voltage (V). In case the data type is enumerated, an appropriate enum legend is shown below the selected option. In this case the node will also output the enumerated textual value as <tt>msg.textvalue</tt>.</p>')
        output('<p>If the data type is <em>float</em>, a dropdown for rounding the output appears.</p>')
        output('<p>By default the node outputs its value every five seconds. If the <em>only changes</em> is checked, the node will only output on value changes.</p>')
      } else {
        output(`## ${node.displayName}`)
      }

      // Output help information
      if (serviceData.help) {
        const helpText = formatHelp(serviceData.help, false, argv.output)
        if (argv.output === 'nodered') {
          output(helpText)
        } else {
          output(`\n${helpText}\n`)
        }
      }

      // Output paths for each category
      for (const categoryName in serviceData) {
        if (categoryName === 'help') continue

        const categoryPaths = serviceData[categoryName]
        const filteredPaths = filterPathsByMode(categoryPaths, false)

        if (Object.keys(filteredPaths).length === 0) continue

        if (argv.output === 'nodered') {
          output(`<h3>${_.capitalize(categoryName)}</h3>`)
          output('<dl class="message-properties">')
        }

        for (const pathKey in filteredPaths) {
          const pathObj = filteredPaths[pathKey]
          output(formatPath(pathObj, argv.output))
        }

        if (argv.output === 'nodered') {
          output('</dl>')
        }
      }

      if (argv.output === 'nodered') {
        output('</script>\n')
      } else {
        output('\n')
      }
    }

    // Generate output nodes section
    if (outputNodes.length > 0) {
      if (argv.output === 'md') {
        output('# Output nodes\n')
        output('Output nodes have the same options available as input nodes, but the selectable _measurement_ only lists writable services. Additionally, the user can set an initial value to the service, which is sent whenever the flow is deployed.\n')
        output('- **Device select** - lists all available devices')
        output('- **Measurement select** - lists all available device-specific measurements')
        output('- **Initial value input field** - lists all available device-specific measurements')
        output('- **Node label input field** - sets a custom label for the node\n')
        output('All output nodes should have the control value set in its incoming messages `msg.payload` property.\n')
        output('![output nodes](https://github.com/victronenergy/node-red-contrib-victron/blob/master/documentation/images/edit-relay-output.png)\n')
      }

      // Generate each output node documentation
      for (const node of outputNodes) {
        const serviceName = node.service
        const serviceData = services[serviceName]

        if (argv.output === 'nodered') {
          const nodeName = getNodeName(serviceName, true)
          output(`<script type="text/x-red" data-help-name="${nodeName}">`)
          output('<h3>Details</h3>')
          output('<p><strong>Output nodes</strong> have the same options available as input nodes, but the selectable measurement only lists writable services. Additionally, the user can set an initial value to the service, which is sent whenever the flow is deployed.</p> <ul> <li><em>Device select</em> - lists all available devices</li> <li><em>Measurement select</em> - lists all available device-specific measurements</li> <li><em>Initial value input field</em> - lists all available device-specific measurements</li> <li><em>Node label input field</em> - sets a custom label for the node</li> </ul> <p>All output nodes should have the control value set in its incoming messages <code>msg.payload</code> property.</p>')
        } else {
          output(`## ${node.displayName}`)
        }

        // Output help information
        if (serviceData.help) {
          const helpText = formatHelp(serviceData.help, true, argv.output)
          if (argv.output === 'nodered') {
            output(helpText)
          } else {
            output(`\n${helpText}\n`)
          }
        }

        // Output paths for each category
        for (const categoryName in serviceData) {
          if (categoryName === 'help') continue

          const categoryPaths = serviceData[categoryName]
          const filteredPaths = filterPathsByMode(categoryPaths, true)

          if (Object.keys(filteredPaths).length === 0) continue

          if (argv.output === 'nodered') {
            output(`<h3>${_.capitalize(categoryName)}</h3>`)
            output('<dl class="message-properties">')
          }

          for (const pathKey in filteredPaths) {
            const pathObj = filteredPaths[pathKey]
            output(formatPath(pathObj, argv.output))
          }

          if (argv.output === 'nodered') {
            output('</dl>')
          }
        }

        if (argv.output === 'nodered') {
          output('</script>\n')
        } else {
          output('\n')
        }
      }
    }

    // Add custom nodes section
    if (argv.output === 'md') {
      output('# Custom nodes')
      output('The custom nodes also have 2 selectable inputs: the (dbus) service and the (dbus) path.')
      output('This obviously comes with a risk, as not all services and paths are supposed to be written to. So only use the custom output node if you have read the documentation and know what you are doing. Also note that used services and paths might change, so there is no guarantee that a node will remain functional after a Venus firmware update.')
    }

  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

// Run the main function
generateDocs()
