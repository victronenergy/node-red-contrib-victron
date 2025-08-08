/**
 * Grid device configuration for Victron Virtual devices
 */

const gridProperties = {
    'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
    'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
    'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'Hz' : '' },
    'Ac/N/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
    ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

/**
 * Configure grid device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureGridDevice (config, iface, ifaceDesc) {
  // Debug: Check if iface has any object properties before we start
  Object.entries(iface).forEach(([key, value]) => {
    if (key !== 'emit' && typeof value === 'object' && value !== null) {
      console.warn(`Warning: Property ${key} is an object before grid configuration:`, value)
    }
  })


  if (config.default_values) {
    iface['Ac/Power'] = 0
    iface['Ac/Frequency'] = 50
    iface['Ac/N/Current'] = 0
}

  // Generate display text using the format function
  const phasesText = gridProperties.NrOfPhases.format(iface.NrOfPhases)

  return `Virtual ${phasesText}-phase grid meter`
}

module.exports = {
  properties: batteryProperties,
  configure: configureBatteryDevice
}