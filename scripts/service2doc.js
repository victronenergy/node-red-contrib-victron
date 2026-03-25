#!/usr/bin/env node

/**
 * Service to Documentation Generator
 *
 * Generates documentation from services.json for both Node-RED and wiki formats.
 * Supports wildcard paths with explanatory information.
 *
 * Usage:
 *   node service2doc.js -s services.json -r reference.html -o nodered
 *   node service2doc.js -s services.json -r reference.html -o md
 *   node service2doc.js -s services.json -r reference.html -o md --page input
 *   node service2doc.js -s services.json -r reference.html -o md --page output
 *   node service2doc.js -s services.json -r reference.html -o md --page virtual
 *   node service2doc.js -s services.json -r reference.html -o md --page index
 *   node service2doc.js -s services.json -r reference.html -o md --page sidebar
 */

const fs = require('fs')
const path = require('path')
const yargs = require('yargs')

// Wildcard explanation mappings
const WILDCARD_EXPLANATIONS = {
  '{type}': 'Switch types (output_1, output_2, pwm_1, relay_1, etc.)',
  '{tracker}': 'PV tracker numbers (0, 1, 2, 3)',
  '{phase}': 'AC phases (1, 2, 3 for L1, L2, L3)',
  '{day}': 'History days (0=today, 1=yesterday)',
  '{input}': 'AC inputs (1, 2)',
  '{channel}': 'DC channels (0, 1)',
  '{index}': 'Index numbers (0, 1, 2, 3, etc.)'
}

/**
 * Generate wildcard explanation section
 */
function generateWildcardExplanation (format) {
  const explanationList = Object.entries(WILDCARD_EXPLANATIONS)
    .map(([wildcard, explanation]) => {
      if (format === 'md') {
        return `  - \`${wildcard}\` - ${explanation}`
      } else {
        return `    <li><code>${wildcard}</code> - ${explanation}</li>`
      }
    })
    .join('\n')

  if (format === 'md') {
    return `
**📝 Wildcard Paths:** Paths containing placeholders like \`{type}\`, \`{tracker}\`, \`{phase}\` will be automatically expanded to show available options based on your connected devices.

${explanationList}
`
  } else {
    return `
<div class="wildcard-info" style="background: #f5f5f5; padding: 10px; margin: 10px 0; border-left: 4px solid #007acc;">
  <strong>📝 Wildcard Paths:</strong> 
  Paths containing placeholders like <code>{type}</code>, <code>{tracker}</code>, <code>{phase}</code> 
  will be automatically expanded to show available options based on your connected devices.
  <ul style="margin: 5px 0;">
${explanationList}
  </ul>
</div>`
  }
}

/**
 * Check if service has wildcard paths
 */
function hasWildcards (servicePaths) {
  return servicePaths.some(pathObj =>
    pathObj.path && pathObj.path.includes('{')
  )
}

/**
 * Highlight wildcards in text
 */
function highlightWildcards (text, format) {
  if (!text) return text

  if (format === 'md') {
    return text.replace(/\{(\w+)\}/g, '`{$1}`')
  } else {
    return text.replace(/\{(\w+)\}/g, '<code style="background-color: #e1f5fe; color: #01579b; font-weight: bold; padding: 1px 3px; border-radius: 3px;">{$1}</code>')
  }
}

/**
 * Generate enum list
 */
function generateEnumList (enumObj, format) {
  if (!enumObj) return ''

  const enumItems = Object.entries(enumObj).map(([key, value]) => {
    if (format === 'md') {
      return `  - ${key} - ${value}`
    } else {
      return `  <li>${key} - ${value}</li>`
    }
  }).join('\n')

  if (format === 'md') {
    return enumItems
  } else {
    return `<ul>\n${enumItems}\n</ul>`
  }
}

/**
 * Generate documentation for a single path
 */
function generatePathDoc (pathObj, format) {
  const name = highlightWildcards(pathObj.name, format)
  const path = highlightWildcards(pathObj.path, format)
  const mode = pathObj.mode ? ` (Mode: ${pathObj.mode})` : ''

  if (format === 'md') {
    let doc = `### ${name}\n`
    doc += `**Type:** ${pathObj.type}\n`
    doc += `**Dbus path:** \`${pathObj.path}\`${mode}\n`

    if (pathObj.enum) {
      doc += '\n**Values:**\n'
      doc += generateEnumList(pathObj.enum, format)
    }

    if (pathObj.remarks) {
      doc += `\n**Note:** ${pathObj.remarks}\n`
    }

    return doc
  } else {
    const wildcardStyle = pathObj.path.includes('{')
      ? ' style="padding-top: 8px; padding-left: 8px;"'
      : ''

    let doc = `  <dt class="optional"${wildcardStyle}>${name}<span class="property-type">${pathObj.type}</span></dt>\n`
    doc += `  <dd${wildcardStyle}>Dbus path: <b>${path}</b><span class="property-mode">${mode}</span>\n`

    if (pathObj.enum) {
      doc += generateEnumList(pathObj.enum, format)
    }

    if (pathObj.remarks) {
      doc += pathObj.remarks
    }

    doc += '</dd>\n'
    return doc
  }
}

/**
 * Generate documentation for a service
 */
function generateServiceDoc (serviceName, serviceData, registeredNodes, format, nodeTypeFilter) {
  const nodeTypes = nodeTypeFilter ? [nodeTypeFilter] : ['input', 'output']
  let doc = ''

  // Process each service type within the service
  Object.entries(serviceData).forEach(([serviceType, serviceTypeData]) => {
    if (serviceType === 'help' || serviceType === 'communityTag') return // Skip help section and communityTag

    const paths = serviceTypeData || []
    if (!Array.isArray(paths) || paths.length === 0) return

    for (const nodeType of nodeTypes) {
      const relevantPaths = paths.filter(pathObj =>
        !pathObj.mode || pathObj.mode === 'both' || pathObj.mode === nodeType
      )

      if (relevantPaths.length === 0) continue

      // Check if the node is actually registered
      const nodeSet = nodeType === 'input' ? registeredNodes.inputNodes : registeredNodes.outputNodes
      if (!nodeSet.has(serviceName)) continue

      const nodeName = `victron-${nodeType}-${serviceName}`
      const title = serviceName === 'motordrive' ? 'E-drive' : serviceName.charAt(0).toUpperCase() + serviceName.slice(1)

      if (format === 'md') {
        doc += `\n## ${title} (${nodeType})\n`

        if (hasWildcards(relevantPaths)) {
          doc += generateWildcardExplanation(format)
        }

        // Add help text if available
        const helpText = serviceData.help?.[nodeType] || serviceData.help?.both
        if (helpText) {
          // Strip HTML tags for markdown and clean up
          const cleanHelp = helpText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
          if (cleanHelp) {
            doc += `\n${cleanHelp}\n`
          }
        }

        relevantPaths.forEach(pathObj => {
          doc += '\n' + generatePathDoc(pathObj, format) + '\n'
        })
      } else {
        doc += `\n<script type="text/x-red" data-help-name="${nodeName}">\n`
        doc += '<h3>Details</h3>\n'

        // Add standard details text
        const nodeTypeText = nodeType === 'input' ? 'input' : 'output'
        doc += `<p>The <strong>${nodeTypeText} nodes</strong> have two selectable inputs: the devices select and measurement select. `
        doc += 'The available options are dynamically updated based on the data that is actually available on the Venus device.</p>\n'

        if (hasWildcards(relevantPaths)) {
          doc += generateWildcardExplanation(format)
        }

        // Add help text if available
        const helpText = serviceData.help?.[nodeType] || serviceData.help?.both
        if (helpText) {
          doc += helpText + '\n'
        }

        doc += `<h3>${title}</h3>\n`
        doc += '<dl class="message-properties">\n'

        relevantPaths.forEach(pathObj => {
          doc += generatePathDoc(pathObj, format)
        })

        doc += '</dl>\n'
        doc += '</script>\n'
      }
    }
  })

  return doc
}

/**
 * Parse reference HTML to get registered nodes
 */
function parseRegisteredNodes (referenceHtml) {
  const inputNodes = new Set()
  const outputNodes = new Set()

  const inputRegex = /registerInputNode\('victron-input-(\w+)'/g
  const outputRegex = /registerOutputNode\('victron-output-(\w+)'/g

  let match
  while ((match = inputRegex.exec(referenceHtml)) !== null) {
    inputNodes.add(match[1])
  }
  while ((match = outputRegex.exec(referenceHtml)) !== null) {
    outputNodes.add(match[1])
  }

  return { inputNodes, outputNodes }
}

// Maps device-type filename to the Input-nodes wiki anchor (when it differs from the filename)
const DEVICE_INPUT_ANCHOR_MAP = {
  motordrive: 'e-drive',
  grid: 'gridmeter'
}

/**
 * Returns the D-Bus service name(s) for a device type, as a markdown string.
 */
function getDbusServiceName (name) {
  if (name === 'generator') {
    return '`com.victronenergy.genset` / `com.victronenergy.dcgenset`'
  }
  return `\`com.victronenergy.${name}\``
}

/**
 * Returns the most relevant paths from a flat properties object, as a markdown string.
 * Prefers immediate:true paths (primary measurements); falls back to non-internal paths.
 */
function getKeyPaths (properties) {
  const allKeys = Object.keys(typeof properties === 'function' ? properties({}) : properties)
  const immediate = allKeys.filter(k => properties[k] && properties[k].immediate)
  const candidates = immediate.length > 0
    ? immediate
    : allKeys.filter(k =>
      !k.startsWith('Alarms/') &&
      !k.startsWith('System/') &&
      !k.startsWith('Settings/') &&
      !k.startsWith('Info/')
    )
  return candidates.slice(0, 5).map(k => `\`/${k}\``).join(', ')
}

/**
 * Load all virtual device-type modules from the device-type directory.
 * Excludes 'switch' which is used internally by the virtual-switch node.
 */
function loadDeviceTypeModules (deviceTypeDir) {
  const dir = deviceTypeDir || path.join(__dirname, '../src/nodes/victron-virtual/device-type')
  const modules = {}
  try {
    fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .forEach(f => {
        const name = path.basename(f, '.js')
        if (name === 'switch') return
        try {
          modules[name] = require(path.join(dir, f))
        } catch (e) {
          console.error(`Failed to load device type module ${name}:`, e.message)
        }
      })
  } catch (e) {
    console.error('Failed to read device type directory:', e.message)
  }
  return modules
}

/**
 * Generate the device types table for the Virtual Device section.
 * Built from the actual device-type module files.
 */
function generateDeviceTypesTable (deviceModules) {
  const header = '| Type | D-Bus service | Key paths | Read node |\n| --- | --- | --- | --- |'

  const rows = Object.entries(deviceModules)
    .sort(([, a], [, b]) => (a.label || '').localeCompare(b.label || ''))
    .map(([name, mod]) => {
      const label = mod.label || (name.charAt(0).toUpperCase() + name.slice(1))

      // Detect nested properties (generator has { genset: {...}, dcgenset: {...} })
      const properties = typeof mod.properties === 'function' ? mod.properties({}) : mod.properties
      const isNested = !Object.values(properties).some(v => v && v.type)
      const flatProperties = isNested ? Object.values(properties)[0] : properties

      const service = getDbusServiceName(name)
      const keyPaths = getKeyPaths(flatProperties)

      const anchorName = DEVICE_INPUT_ANCHOR_MAP[name] || name
      const anchorTitle = anchorName.charAt(0).toUpperCase() + anchorName.slice(1)
      const inputLink = `[${anchorTitle} input](Input-nodes#${anchorName}-input)`

      return `| ${label} | ${service} | ${keyPaths} | ${inputLink} |`
    })

  return header + '\n' + rows.join('\n')
}

/**
 * Generate overview section with links to all nodes.
 * page: 'input' | 'output' | 'index' | undefined (backward compat, all-in-one)
 */
function generateOverview (servicesData, registeredNodes, format, page) {
  if (format !== 'md') return ''

  const isIndexPage = page === 'index'
  const showInput = !page || page === 'input' || isIndexPage
  const showOutput = !page || page === 'output' || isIndexPage

  const services = Object.keys(servicesData).sort()

  const inputNodesSet = new Set()
  const outputNodesSet = new Set()

  services.forEach(serviceName => {
    const serviceData = servicesData[serviceName]
    const title = serviceName === 'motordrive' ? 'E-drive' : serviceName.charAt(0).toUpperCase() + serviceName.slice(1)
    let hasAnyInput = false
    let hasAnyOutput = false

    Object.entries(serviceData).forEach(([serviceType, serviceTypeData]) => {
      if (serviceType === 'help' || serviceType === 'communityTag') return

      const paths = serviceTypeData || []
      if (paths.length === 0) return

      if (paths.some(p => !p.mode || p.mode === 'both' || p.mode === 'input')) {
        hasAnyInput = true
      }
      if (paths.some(p => !p.mode || p.mode === 'both' || p.mode === 'output')) {
        hasAnyOutput = true
      }
    })

    // Derive the actual GitHub wiki anchor from the heading title (lowercase, hyphens, no parens)
    const titleAnchor = title.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')

    if (hasAnyInput && registeredNodes.inputNodes.has(serviceName)) {
      const href = isIndexPage ? `Input-nodes#${titleAnchor}-input` : `#${titleAnchor}-input`
      inputNodesSet.add(`[${title}](${href})`)
    }
    if (hasAnyOutput && registeredNodes.outputNodes.has(serviceName)) {
      const href = isIndexPage ? `Output-nodes#${titleAnchor}-output` : `#${titleAnchor}-output`
      outputNodesSet.add(`[${title} Control](${href})`)
    }
  })

  const inputNodesList = Array.from(inputNodesSet)
  const outputNodesList = Array.from(outputNodesSet)

  let overview = ''
  if (showInput && inputNodesList.length > 0) {
    overview += `**Input nodes:** ${inputNodesList.join(', ')}\n\n`
  }
  if (showOutput && outputNodesList.length > 0) {
    overview += `**Output nodes:** ${outputNodesList.join(', ')}\n\n`
  }

  if (!page || isIndexPage) {
    overview += 'If there are services and paths not covered by the above nodes, there are also 2 [custom nodes](#custom-nodes) that allow you to read from and write to all found dbus services and paths.\n\n'
    overview += '**Other nodes:** [Virtual Device](Virtual-devices#virtual-device), [Virtual Switch](Virtual-devices#virtual-switch), [Inject Notification](Virtual-devices#inject-notification)\n\n'
  } else if (page === 'input') {
    overview += 'For writing values to control devices, see [Output nodes](Output-nodes).\n'
    overview += 'For creating virtual Victron devices on D-Bus, see [Virtual devices](Virtual-devices).\n\n'
  } else if (page === 'output') {
    overview += 'For reading values from devices, see [Input nodes](Input-nodes).\n'
    overview += 'For creating virtual Victron devices on D-Bus, see [Virtual devices](Virtual-devices).\n\n'
  }

  return overview
}

/**
 * Generate documentation for the special nodes not covered by services.json
 * (victron-virtual, victron-virtual-switch, victron-inject)
 */
function generateSpecialNodesDoc (deviceModules) {
  const deviceTypesTable = generateDeviceTypesTable(deviceModules || loadDeviceTypeModules())
  return `
## Virtual Device

The _Virtual Device_ node creates a virtual Victron device on D-Bus, making it appear as a real device to Venus OS and the VRM portal. This is useful for feeding external data (e.g. from a sensor or third-party system) into the Victron ecosystem.

The service name on D-Bus will be \`com.victronenergy.<type>.virtual_<nodeId>\`.

### Usage

Send \`msg.payload\` as a JavaScript object where keys are D-Bus path names (without the leading \`/\`) and values are the corresponding readings:

\`\`\`javascript
msg.payload = {
    "Dc/0/Voltage": 48.2,
    "Dc/0/Current": 12.5,
    "Soc": 85
};
\`\`\`

Set \`msg.connected = false\` to take the device offline (releases the D-Bus service name), or \`msg.connected = true\` to bring it back online.

### Device types

${deviceTypesTable}

### Output

- **Port 1 (Passthrough):** Passes through the original \`msg\` with \`msg.connected\` set to the current D-Bus connection state.

---

## Virtual Switch

The _Virtual Switch_ node creates a virtual I/O extender switch on D-Bus, appearing to Venus OS as a connected Cerbo GX I/O extender device. The GX device GUI will show the virtual switch and allow interaction with it.

### Usage

Send \`msg.payload\` as a JavaScript object with the property to set:

\`\`\`javascript
msg.payload = { "SwitchableOutput/output_1/State": 1 };  // Turn on
msg.payload = { "SwitchableOutput/output_1/Dimming": 75 };  // Set dimming to 75%
\`\`\`

Set \`msg.connected = false\` to take the switch offline.

### Switch types

| Type | Description | D-Bus path |
| --- | --- | --- |
| On/Off | Simple toggle | \`/SwitchableOutput/{type}/State\` (0=Off, 1=On) |
| Dimmable | On/off with dimming level | \`/SwitchableOutput/{type}/State\`, \`/SwitchableOutput/{type}/Dimming\` (0-100%) |
| Temperature setpoint | Thermostat slider | \`/SwitchableOutput/{type}/Dimming\` (°C), \`/SwitchableOutput/{type}/Measurement\` |
| Stepped | Slider with steps | \`/SwitchableOutput/{type}/Dimming\`, \`/SwitchableOutput/{type}/State\` |
| Basic slider | Numeric slider | \`/SwitchableOutput/{type}/Dimming\` |
| Dropdown | Selection list | \`/SwitchableOutput/{type}/State\` |
| Numeric input | Free numeric entry | \`/SwitchableOutput/{type}/Dimming\`, \`/SwitchableOutput/{type}/State\` |
| Three state | Off/On/Auto | \`/SwitchableOutput/{type}/State\` (0=Off, 1=On, 2=Auto) |
| RGB color wheel | RGB color picker | \`/SwitchableOutput/{type}/State\`, \`/SwitchableOutput/{type}/LightControls\` |
| CCT wheel | Color temperature | \`/SwitchableOutput/{type}/State\`, \`/SwitchableOutput/{type}/LightControls\` |
| RGB+White dimmer | RGBW dimmer | \`/SwitchableOutput/{type}/State\`, \`/SwitchableOutput/{type}/LightControls\` |

### Output

- **Port 1 (Passthrough):** Passes through the original \`msg\` with \`msg.connected\` set to the current D-Bus connection state.
- **Port 2 (State):** Emits a message when the switch state changes, with \`msg.payload\` containing the new state value.
- **Port 3 (Value, if applicable):** Emits a message when the dimming/value changes (for dimmable, stepped, numeric, and RGB types).

---

## Inject Notification

The _Inject Notification_ node sends a notification to the Venus OS notification center, where it appears in the GX device GUI.

Notifications are sent to D-Bus at \`com.victronenergy.platform /Notifications/Inject\`.

### Configuration

- **Type:** The notification severity: Warning (0), Alarm (1), or Information (2).
- **Title:** The notification title displayed in the GUI.

### Usage

Send the notification message in \`msg.payload\`:

\`\`\`javascript
msg.payload = "Battery voltage is low";
\`\`\`

Override the configured type and title at runtime:

\`\`\`javascript
msg.payload = "Critical temperature alert";
msg.type = "alarm";   // string: "warning", "alarm", "info" - or number: 0, 1, 2
msg.title = "Temperature Alert";
\`\`\`

Title is truncated to 100 characters and message to 500 characters.

### Output

Passes through the original \`msg\` with \`msg.notification\` added:

\`\`\`javascript
msg.notification = {
    type: 1,              // type number used
    title: "Battery Alert",
    message: "Battery voltage is low"
}
\`\`\`
`
}

const NODERED_CSS = `
<style>
  .wildcard-info {
    background: #f5f5f5;
    padding: 10px;
    margin: 10px 0;
    border-left: 4px solid #007acc;
    border-radius: 4px;
  }

  .wildcard-info code {
    background-color: #e1f5fe;
    color: #01579b;
    font-weight: bold;
    padding: 1px 3px;
    border-radius: 3px;
  }

  .wildcard-info ul {
    margin: 5px 0 0 0;
    padding-left: 20px;
  }

  dt[style*="border-left"], dd[style*="border-left"] {
    background: #fcfcfc;
  }
</style>

`

function generateInputPageDoc (servicesData, registeredNodes) {
  let doc = '# Input Nodes\n\n'
  doc += 'Input nodes subscribe to D-Bus values from Victron devices connected to Venus OS. '
  doc += 'Each node outputs a message whenever the subscribed value changes.\n\n'
  doc += generateOverview(servicesData, registeredNodes, 'md', 'input')
  Object.entries(servicesData)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([serviceName, serviceData]) => {
      doc += generateServiceDoc(serviceName, serviceData, registeredNodes, 'md', 'input')
    })
  return doc
}

function generateOutputPageDoc (servicesData, registeredNodes) {
  let doc = '# Output Nodes\n\n'
  doc += 'Output (control) nodes write values to Victron devices. '
  doc += 'Send a message with `msg.payload` containing the value to set.\n\n'
  doc += generateOverview(servicesData, registeredNodes, 'md', 'output')
  Object.entries(servicesData)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([serviceName, serviceData]) => {
      doc += generateServiceDoc(serviceName, serviceData, registeredNodes, 'md', 'output')
    })
  return doc
}

function generateVirtualPageDoc (deviceModules) {
  let doc = '# Virtual Devices\n\n'
  doc += 'These nodes create virtual Victron devices on D-Bus or inject data into Venus OS.\n\n'
  doc += 'For reading values from physical devices, see [Input nodes](Input-nodes).\n\n'
  doc += generateSpecialNodesDoc(deviceModules)
  return doc
}

function generateIndexPageDoc (servicesData, registeredNodes) {
  let doc = '# Available Nodes\n\n'
  doc += 'This wiki covers all nodes provided by the node-red-contrib-victron package.\n\n'
  doc += '## Node types\n\n'
  doc += '- **[Input nodes](Input-nodes)** - Read values from Victron devices connected to Venus OS.\n'
  doc += '- **[Output / Control nodes](Output-nodes)** - Write values to control Victron devices.\n'
  doc += '- **[Virtual devices](Virtual-devices)** - Create virtual Victron devices on D-Bus or inject data into Venus OS.\n\n'
  doc += generateOverview(servicesData, registeredNodes, 'md', 'index')
  return doc
}

function generateSidebarDoc () {
  return `## Navigation
* [Home](Home)
* [Available Nodes](Available-nodes)
  * [Input Nodes](Input-nodes)
  * [Output Nodes](Output-nodes)
  * [Virtual Devices](Virtual-devices)
* [Example Flows](Example-Flows)
`
}

/**
 * Main documentation generation function.
 * page: 'input' | 'output' | 'virtual' | 'index' | 'sidebar' | undefined (backward compat)
 */
function generateDocumentation (servicesData, registeredNodes, format, page) {
  if (format === 'nodered') {
    let doc = NODERED_CSS
    Object.entries(servicesData)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([serviceName, serviceData]) => {
        doc += generateServiceDoc(serviceName, serviceData, registeredNodes, format)
      })
    return doc
  }

  // markdown format - route by page
  const deviceModules = loadDeviceTypeModules()
  switch (page) {
    case 'input': return generateInputPageDoc(servicesData, registeredNodes)
    case 'output': return generateOutputPageDoc(servicesData, registeredNodes)
    case 'virtual': return generateVirtualPageDoc(deviceModules)
    case 'index': return generateIndexPageDoc(servicesData, registeredNodes)
    case 'sidebar': return generateSidebarDoc()
    default: {
      // backward compat: generate everything in one file
      let doc = '# Available Nodes\n\n'
      doc += 'This document lists all available Victron Energy nodes and their measurable values.\n\n'
      doc += generateOverview(servicesData, registeredNodes, format)
      Object.entries(servicesData)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([serviceName, serviceData]) => {
          doc += generateServiceDoc(serviceName, serviceData, registeredNodes, format)
        })
      doc += generateSpecialNodesDoc(deviceModules)
      return doc
    }
  }
}

/**
 * Main execution
 */
function main () {
  // Command line argument parsing
  const argv = yargs
    .option('s', {
      alias: 'services',
      describe: 'Path to services.json file',
      type: 'string',
      demandOption: true
    })
    .option('r', {
      alias: 'reference',
      describe: 'Path to reference HTML file',
      type: 'string',
      demandOption: true
    })
    .option('o', {
      alias: 'output',
      describe: 'Output format: nodered or md',
      type: 'string',
      choices: ['nodered', 'md'],
      demandOption: true
    })
    .option('page', {
      describe: 'Wiki page to generate: input, output, virtual, index, sidebar',
      type: 'string',
      choices: ['input', 'output', 'virtual', 'index', 'sidebar']
    })
    .help()
    .argv

  try {
    // Read services.json
    const servicesPath = path.resolve(argv.services)
    if (!fs.existsSync(servicesPath)) {
      console.error(`Services file not found: ${servicesPath}`)
      process.exit(1)
    }

    const servicesData = JSON.parse(fs.readFileSync(servicesPath, 'utf8'))

    // Read reference HTML file
    const referencePath = path.resolve(argv.reference)
    if (!fs.existsSync(referencePath)) {
      console.error(`Reference file not found: ${referencePath}`)
      process.exit(1)
    }

    const referenceHtml = fs.readFileSync(referencePath, 'utf8')
    const registeredNodes = parseRegisteredNodes(referenceHtml)

    // Generate documentation
    const documentation = generateDocumentation(servicesData, registeredNodes, argv.output, argv.page)

    // Output to stdout (for piping)
    process.stdout.write(documentation)
  } catch (error) {
    console.error('Error generating documentation:', error)
    process.exit(1)
  }
}

// Execute if run directly
if (require.main === module) {
  main()
}

module.exports = {
  generateDocumentation,
  generateWildcardExplanation,
  highlightWildcards,
  loadDeviceTypeModules,
  generateDeviceTypesTable,
  generateSpecialNodesDoc
}
