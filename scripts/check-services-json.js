// Also see https://github.com/victronenergy/node-red-contrib-victron/issues/115
//
// Compares services.json against the dbus_modbustcp attributes.csv (see
// https://github.com/victronenergy/dbus_modbustcp/blob/master/attributes.csv),
// which lists every dbus path that project knows about together with its
// type/enum/unit info. That csv is the most complete public reference we
// have for dbus paths, even though not every dbus path ends up exposed over
// Modbus TCP (see scripts/exclude.txt for known, intentional gaps).

const fs = require('fs')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 -s services.json -c attributes.csv')
  .option('services', {
    alias: 's',
    describe: 'Services file',
    default: 'src/services/services.json'
  })
  .option('csv', {
    alias: 'c',
    describe: 'attributes.csv file from the dbus_modbustcp repository',
    default: '../dbus_modbustcp/attributes.csv'
  })
  .help('h')
  .version(false)
  .argv

const servicesJSON = argv.services
const csvFile = argv.csv

// Maps a dbus interface name (e.g. "charger") to the top-level node name
// used in services.json (e.g. "accharger"). Interfaces not listed here use
// their own name as the node name.
const IFACE_TO_NODE = {
  grid: 'gridmeter',
  charger: 'accharger',
  genset: 'generator',
  dcgenset: 'generator'
}

// Interfaces that are intentionally not modelled in services.json.
const SKIP_IFACES = new Set([
  'hub4', // writing here interferes with systemcalc
  'platform' // internal, not a device type
])

const services = JSON.parse(fs.readFileSync(servicesJSON))

const parse = require('csv-parse/lib/sync')

const rows = parse(fs.readFileSync(csvFile, 'utf8'), {
  relax_column_count: true,
  skip_empty_lines: true,
  trim: true,
  comment: '#'
})
  .map(([service, path, type, unitOrEnum, register, datatype, scale, access]) => ({
    service,
    path,
    type,
    unitOrEnum,
    register,
    datatype,
    scale,
    access
  }))
  .filter(row => row.service && row.service.startsWith('com.victronenergy.'))

function guessType (row) {
  if (row.unitOrEnum && row.unitOrEnum.includes(';')) return 'enum'
  if (row.datatype && row.datatype.match(/string/)) return 'string'
  return 'float'
}

function guessEnum (row) {
  const enumValues = {}
  row.unitOrEnum.split(';').forEach(entry => {
    const [key, value] = entry.split('=')
    enumValues[key.trim()] = value.trim()
  })
  return enumValues
}

// services.json paths can contain wildcard segments like "L{index}" or
// "{phase}" that expand against live dbus data at runtime. Build a regex out
// of a template path so it also matches the concrete paths reported in the
// csv (e.g. "/Ac/Out/{phase}/V" should match "/Ac/Out/L1/V").
function templateToRegex (templatePath) {
  const escaped = templatePath.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
  const pattern = escaped.replace(/\{[^}]+\}/g, '[^/]+')
  return new RegExp('^' + pattern + '$')
}

console.log('// Checking for paths present in attributes.csv but missing from services.json')
rows.forEach(row => {
  if (row.path === 'RESERVED') return

  const iface = row.service.replace('com.victronenergy.', '')
  if (SKIP_IFACES.has(iface)) return

  const node = IFACE_TO_NODE[iface] || iface

  if (row.path.match(/\/Relay\/\d+\/State/)) {
    if (!services.relay || !services.relay[node]) {
      console.log(`// Missing relay service for ${node}, path: ${row.path}`)
    }
    return
  }

  if (!services[node]) {
    console.log(`// Missing node in services.json: ${node} (from interface ${iface})`)
    return
  }

  if (!services[node][iface]) {
    console.log(`// Missing service in services.json node "${node}": ${iface}`)
    return
  }

  const matches = services[node][iface].some(entry => templateToRegex(entry.path).test(row.path))
  if (!matches) {
    const type = guessType(row)
    const missing = {
      path: row.path,
      type,
      name: null // fill in a human-readable name before adding this entry
    }
    if (type === 'enum') missing.enum = guessEnum(row)

    console.log(`// Missing path in services.json node "${node}", service "${iface}": ${row.path} (access: ${row.access}, register: ${row.register})`)
    console.log(JSON.stringify(missing, null, 2))
  }
})

console.log('// Checking services.json for entries not present in attributes.csv')
for (const [node, nodeData] of Object.entries(services)) {
  for (const [iface, entries] of Object.entries(nodeData)) {
    if (iface === 'help' || iface === 'communityTag') continue

    const dbusServiceName = 'com.victronenergy.' + iface
    entries.forEach(entry => {
      if (entry.path.match(/\/Relay\//)) return // relay coverage in the csv is spotty, skip

      const regex = templateToRegex(entry.path)
      const found = rows.some(row => row.service === dbusServiceName && regex.test(row.path))
      if (!found) {
        console.log(`${node}:${iface}:${entry.path}`)
      }
    })
  }
}
