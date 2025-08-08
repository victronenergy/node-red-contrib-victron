/**
 * Temperature device configuration for Victron Virtual devices
 */

const temperatureProperties = {
  Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 60 },
  TemperatureType: {
    type: 'i',
    value: 2,
    min: 0,
    max: 2,
    format: (v) => ({
      0: 'Battery',
      1: 'Fridge',
      2: 'Generic',
      3: 'Room',
      4: 'Outdoor',
      5: 'WaterHeater',
      6: 'Freezer'
    }[v] || 'unknown')
  },
  Pressure: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'hPa' : '', persist: 60 },
  Humidity: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '%' : '', persist: 60 },
  BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  Status: { type: 'i', persist: true }
}

/**
 * Configure temperature device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureTemperatureDevice (config, iface, ifaceDesc) {
  iface.TemperatureType = Number(config.temperature_type ?? 2)

  if (config.default_values) {
    iface.Temperature = 25
    iface.Humidity = 50
    iface.Pressure = 1013
    iface.BatteryVoltage = 3.3
  }

  // Ensure TemperatureType has a value, defaulting to Generic (2) if not set
  if (iface.TemperatureType == null) {
    iface.TemperatureType = temperatureProperties.TemperatureType.value
  }

  return `Virtual ${temperatureProperties.TemperatureType.format(iface.TemperatureType).toLowerCase()} temperature sensor`
}

module.exports = {
  properties: temperatureProperties,
  configure: configureTemperatureDevice
}
