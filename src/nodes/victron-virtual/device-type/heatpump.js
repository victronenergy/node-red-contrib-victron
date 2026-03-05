const properties = {
  'Ac/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
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

const phaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Energy/Forward', unit: 'kWh' },
  { name: 'Energy/Reverse', unit: 'kWh' },
  { name: 'Power', unit: 'W' },
  { name: 'PowerFactor', unit: '' },
  { name: 'Voltage', unit: 'V' }
]

function initialize (config, ifaceDesc, iface, node) {
  iface.NrOfPhases = Number(config.heatpump_nrofphases ?? 1)
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
  return `Virtual ${iface.NrOfPhases}-phase heat pump`
}

module.exports = { properties, initialize, label: 'Heat pump' }
