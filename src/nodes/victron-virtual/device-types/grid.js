/**
 * Grid device configuration for Victron Virtual devices
 */

const gridProperties = {
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  DeviceType: { type: 'i', value: 71 }, // Energy meter
  Role: { type: 's', value: 'grid' },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'Hz' : '' },
  'Ac/N/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' }
}

/**
 * Configure grid device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureGridDevice (config, iface, ifaceDesc) {
  iface.NrOfPhases = Number(config.grid_nrofphases ?? 1)
  
  const properties = [
    { name: 'Current', unit: 'A' },
    { name: 'Power', unit: 'W' },
    { name: 'Voltage', unit: 'V' },
    { name: 'Energy/Forward', unit: 'kWh' },
    { name: 'Energy/Reverse', unit: 'kWh' }
  ]
  
  for (let i = 1; i <= iface.NrOfPhases; i++) {
    const phase = `L${i}`
    properties.forEach(({ name, unit }) => {
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

module.exports = {
  properties: gridProperties,
  configure: configureGridDevice
}
