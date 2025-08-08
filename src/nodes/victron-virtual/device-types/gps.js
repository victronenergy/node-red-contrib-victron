/**
 * GPS device configuration for Victron Virtual devices
 */

const gpsProperties = {
  Altitude: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm' : '' },
  Fix: { type: 'i' },
  NrOfSatellites: { type: 'i' },
  'Position/Latitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: 300 },
  'Position/Longitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: 300 },
  Speed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '' },
  Course: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '°' : '' },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

/**
 * Configure GPS device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureGpsDevice (config, iface, ifaceDesc) {
  // GPS devices do NOT set default values to avoid putting the device
  // unintentionally in the middle of the ocean and messing up solar forecast.
  // This is explicitly mentioned in the project documentation.

  return 'Virtual GPS'
}

module.exports = {
  properties: gpsProperties,
  configure: configureGpsDevice
}
