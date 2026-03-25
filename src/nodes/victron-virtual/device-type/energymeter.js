const sharedProperties = {
  'Ac/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', value: 0 },
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
  'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/PowerFactor': { type: 'd', format: (v) => v != null ? v.toFixed(2) : '' },
  'Ac/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  DeviceType: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  IsGenericEnergyMeter: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

function buildProperties (config) {
  console.log('Building properties for energy meter with config:', config)

  // make copy of sharedProperties to avoid modifying the original object
  const properties = { ...sharedProperties }

  switch (config.energymeter_role) {
    case 'gridmeter':
      break
    default:
      properties.Position = { type: 'i', format: (v) => v === 0 ? 'output' : 'input', value: 0 }
  }

  return properties
}

const phaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Energy/Forward', unit: 'kWh' },
  { name: 'Energy/Reverse', unit: 'kWh' },
  { name: 'Power', unit: 'W' },
  { name: 'PowerFactor', unit: '' },
  { name: 'Voltage', unit: 'V' }
]

function initialize (config, ifaceDesc, iface, node) {
  iface.NrOfPhases = Number(config.energymeter_nrofphases ?? 1)
  for (let i = 1; i <= iface.NrOfPhases; i++) {
    const phase = `L${i}`
    phaseProperties.forEach(({ name, unit }) => {
      const key = `Ac/${phase}/${name}`
      ifaceDesc.properties[key] = {
        type: 'd',
        format: (v) => v != null ? v.toFixed(2) + unit : ''
      }
      iface[key] = 0
    })
  }
  if (config.default_values) {
    iface['Ac/Power'] = 0
    iface['Ac/Energy/Forward'] = 0
    iface['Ac/Energy/Reverse'] = 0
  }
  return `Virtual ${iface.NrOfPhases}-phase energy meter`
}

module.exports = {
  properties: buildProperties,
  initialize,
  label: 'Energy meter',
  // we export sharedProperties for unit testing
  __sharedProperties: sharedProperties
}
