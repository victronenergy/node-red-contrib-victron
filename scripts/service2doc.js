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

    doc += '</dd>\n'
    return doc
  }
}

/**
 * Generate documentation for a service
 */
function generateServiceDoc (serviceName, serviceData, format) {
  const nodeTypes = ['input', 'output']
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

/**
 * Generate overview section with links to all nodes
 */
function generateOverview (servicesData, registeredNodes, format) {
  if (format !== 'md') return ''

  const services = Object.keys(servicesData).sort()

  const inputNodesSet = new Set()
  const outputNodesSet = new Set()

  services.forEach(serviceName => {
    const serviceData = servicesData[serviceName]
    const title = serviceName === 'motordrive' ? 'E-drive' : serviceName.charAt(0).toUpperCase() + serviceName.slice(1)
    const anchor = serviceName.toLowerCase()

    let hasAnyInput = false
    let hasAnyOutput = false

    Object.entries(serviceData).forEach(([serviceType, serviceTypeData]) => {
      if (serviceType === 'help') return

      const paths = serviceTypeData || []
      if (paths.length === 0) return

      if (paths.some(p => !p.mode || p.mode === 'both' || p.mode === 'input')) {
        hasAnyInput = true
      }
      if (paths.some(p => !p.mode || p.mode === 'both' || p.mode === 'output')) {
        hasAnyOutput = true
      }
    })

    if (hasAnyInput && registeredNodes.inputNodes.has(serviceName)) {
      inputNodesSet.add(`[${title}](#${anchor}-input)`)
    }
    if (hasAnyOutput && registeredNodes.outputNodes.has(serviceName)) {
      outputNodesSet.add(`[${title} Control](#${anchor}-output)`)
    }
  })

  const inputNodesList = Array.from(inputNodesSet)
  const outputNodesList = Array.from(outputNodesSet)

  let overview = ''
  if (inputNodesList.length > 0) {
    overview += `**Input nodes:** ${inputNodesList.join(', ')}\n\n`
  }
  if (outputNodesList.length > 0) {
    overview += `**Output nodes:** ${outputNodesList.join(', ')}\n\n`
  }
  overview += 'If there are services and paths not covered by the above nodes, there are also 2 [custom nodes](#custom-nodes) that allow you to read from and write to all found dbus services and paths.\n\n'

  return overview
}

/**
 * Main documentation generation function
 */
function generateDocumentation (servicesData, registeredNodes, format) {
  let doc = ''

  if (format === 'md') {
    doc += '# Available Nodes\n\n'
    doc += 'This document lists all available Victron Energy nodes and their measurable values.\n\n'
    doc += generateOverview(servicesData, registeredNodes, format)
  } else {
    // Add CSS for wildcard styling in Node-RED format
    doc += `
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
  }

  // Generate documentation for each service
  Object.entries(servicesData)
    .sort(([a], [b]) => a.localeCompare(b)) // Sort services alphabetically
    .forEach(([serviceName, serviceData]) => {
      doc += generateServiceDoc(serviceName, serviceData, format)
    })

  return doc
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
    const documentation = generateDocumentation(servicesData, registeredNodes, argv.output)

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
  highlightWildcards
}
