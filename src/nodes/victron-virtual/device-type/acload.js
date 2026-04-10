const properties = {
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'kWh' : '', value: 0 },
  'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'kWh' : '', value: 0 },
  'Ac/L1/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
  'Ac/L1/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'kWh' : '', value: 0 },
  'Ac/L1/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'kWh' : '', value: 0 },
  'Ac/L1/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/L1/PowerFactor': { type: 'd', format: (v) => v != null ? v.toFixed(2) : '' },
  'Ac/L1/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

const phaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Power', unit: 'W' },
  { name: 'Voltage', unit: 'V' },
  { name: 'Energy/Forward', unit: 'kWh' },
  { name: 'Energy/Reverse', unit: 'kWh' },
  { name: 'PowerFactor', unit: '' }
]

const additionalS2Properties = {
  'S2/0/Active': { type: 'i' },
  'S2/0/RmSettings/OffHysteresis': { type: 'i' },
  'S2/0/RmSettings/OnHysteresis': { type: 'i' },
  'S2/0/RmSettings/PowerSetting': { type: 'i' },
  'S2/0/Rm': { type: 's', format: (v) => v != null ? v : '' }
}

const s2Defaults = {
  'S2/0/Active': 0,
  'S2/0/RmSettings/OffHysteresis': 30,
  'S2/0/RmSettings/OnHysteresis': 30,
  'S2/0/RmSettings/PowerSetting': 1000,
  'S2/0/Priority': null,
  'S2/0/Rm': ''
}

function initialize (config, ifaceDesc, iface, node) {
  iface.NrOfPhases = Number(config.acload_nrofphases ?? 1)
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

  if (config.enable_s2support) {
    console.warn('S2 support for acload virtual device is not yet implemented.')

    Object.entries(additionalS2Properties).forEach(([key, desc]) => {
      ifaceDesc.properties[key] = desc
      iface[key] = s2Defaults[key]
    })

    ifaceDesc.__enableS2 = true
    // Maps D-Bus property names to S2 CommodityQuantity values for power measurement reporting
    ifaceDesc.__s2PowerMeasurementProps = {
      'Ac/Power': 'ELECTRIC.POWER.3_PHASE_SYMMETRIC'
    }
    ifaceDesc.__s2Handlers = {
      Connect: function (cemId, timeout) {
        console.log('Connect received for CEM ID:', cemId, 'timeout', timeout)
        node.send([
          null,
          {
            payload: {
              command: 'Connect',
              cemId,
              keepAliveInterval: timeout
            }
          }
        ])
      },
      Disconnect: function (cemId) {
        node.send([
          null,
          {
            payload: {
              command: 'Disconnect',
              cemId
            }
          }
        ])
      },
      Message: function (cemId, message) {
        node.send([
          null,
          {
            payload: {
              command: 'Message',
              cemId,
              message
            }
          }
        ])
      },
      KeepAlive: function (cemId) {
        console.log('KeepAlive received for CEM ID:', cemId)
        node.send([
          null,
          {
            payload: {
              command: 'KeepAlive',
              cemId
            }
          }
        ])
        // D-Bus method must return a value - return true to indicate RM is alive
        return true
      }
    }
  }

  return `Virtual ${iface.NrOfPhases}-phase AC load`
}

module.exports = { properties, initialize, label: 'AC Load' }
