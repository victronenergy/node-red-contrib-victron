/**
 * Switch device configuration for Victron Virtual devices
 */

const switchProperties = {
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  State: { type: 'i', value: 0x100 }
}

/**
 * Configure switch device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureSwitchDevice (config, iface, ifaceDesc) {
  const switchCount = Number(config.switch_count ?? 1)

  const baseProperties = [
    { name: 'State', type: 'i', format: (v) => ({ 0: 'Off', 1: 'On' }[v] || 'unknown'), persist: true },
    { name: 'Status', type: 'i', format: (v) => v != null ? v : '' },
    { name: 'Name', type: 's', persist: true },
    { name: 'Settings/Group', type: 's', value: '', persist: true },
    { name: 'Settings/CustomName', type: 's', value: '', persist: true },
    { name: 'Settings/Type', type: 'i', format: (v) => ({ 0: 'Momentary', 1: 'Toggle', 2: 'Dimmable' }[v] || 'unknown'), persist: false },
    { name: 'Settings/ValidTypes', type: 'i', value: 0x7 } // Allow all types
  ]

  for (let i = 1; i <= switchCount; i++) {
    const switchType = Number(config[`switch_${i}_type`] ?? 1)

    baseProperties.forEach(({ name, type, value, format, persist }) => {
      const key = `SwitchableOutput/output_${i}/${name}`
      ifaceDesc.properties[key] = { type, format, persist }

      let propValue = value
      if (name === 'Name') propValue = `Switch ${i}`
      if (name === 'Settings/Type') propValue = switchType

      iface[key] = propValue !== undefined ? propValue : 0
    })

    // Add dimming property for dimmable switches (type 2)
    if (switchType === 2) {
      const dimmingKey = `SwitchableOutput/output_${i}/Dimming`
      ifaceDesc.properties[dimmingKey] = {
        type: 'd',
        format: (v) => v != null ? v.toFixed(1) + '%' : '',
        min: 0,
        max: 100,
        persist: true
      }
      iface[dimmingKey] = 0
    }
  }

  return `Virtual switch with ${switchCount} output${switchCount > 1 ? 's' : ''}`
}

module.exports = {
  properties: switchProperties,
  configure: configureSwitchDevice
}
