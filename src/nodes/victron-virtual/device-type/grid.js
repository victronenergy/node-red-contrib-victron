const properties = {
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
  'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
  'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'Hz' : '' },
  'Ac/N/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

const phaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Power', unit: 'W' },
  { name: 'Voltage', unit: 'V' },
  { name: 'Energy/Forward', unit: 'kWh' },
  { name: 'Energy/Reverse', unit: 'kWh' }
]

function initialize (config, ifaceDesc, iface, node) {
  iface.NrOfPhases = Number(config.grid_nrofphases ?? 1)
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
    iface['Ac/Frequency'] = 50
    iface['Ac/N/Current'] = 0
  }
  return `Virtual ${iface.NrOfPhases}-phase grid meter`
}

module.exports = { properties, initialize, label: 'Grid meter' }
