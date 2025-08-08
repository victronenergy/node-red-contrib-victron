/**
 * Meteo device configuration for Victron Virtual devices
 */

const meteoProperties = {
  CellTemperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 300 },
  ExternalTemperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 300 },
  Irradiance: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'W/m2' : '', persist: 300 },
  WindSpeed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '', persist: 300 },
  WindDirection: { type: 'i', persist: 300 }
}

/**
 * Configure meteo device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureMeteoDevice (config, iface, ifaceDesc) {
  if (config.default_values) {
    iface.Irradiance = 0
    iface.WindSpeed = 0
  }

  return 'Virtual meteo'
}

module.exports = {
  properties: meteoProperties,
  configure: configureMeteoDevice
}
