const properties = {
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/MaxPower': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/PowerLimit': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  ErrorCode: {
    type: 'i',
    value: 0,
    format: (v) => ({
      0: 'No error'
    }[v] || 'unknown')
  },
  Position: {
    type: 'i',
    format: (v) => ({
      0: 'AC input 1',
      1: 'AC output',
      2: 'AC input 2'
    }[v] || 'unknown')
  },
  StatusCode: {
    type: 'i',
    format: (v) => ({
      0: 'Startup 0',
      1: 'Startup 1',
      2: 'Startup 2',
      3: 'Startup 3',
      4: 'Startup 4',
      5: 'Startup 5',
      6: 'Startup 6',
      7: 'Running',
      8: 'Standby',
      9: 'Boot loading',
      10: 'Error'
    }[v] || 'unknown')
  },
  NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

const phaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Power', unit: 'W' },
  { name: 'Voltage', unit: 'V' },
  { name: 'Energy/Forward', unit: 'kWh' }
]

function initialize (config, ifaceDesc, iface, node) {
  iface.Position = Number(config.position ?? 0)
  iface.NrOfPhases = Number(config.pvinverter_nrofphases ?? 1)
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
    iface['Ac/MaxPower'] = 1000
    iface['Ac/PowerLimit'] = 1000
    iface['Ac/Energy/Forward'] = 0
    iface.ErrorCode = 0
    iface.StatusCode = 0
  }
  return `Virtual ${iface.NrOfPhases}-phase pvinverter`
}

module.exports = { properties, initialize, label: 'PV inverter' }
