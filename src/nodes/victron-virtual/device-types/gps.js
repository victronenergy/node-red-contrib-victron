/**
 * GPS device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:gps')
const utils = require('../utils')

/**
 * GPS properties definition
 */
const gpsProperties = {
  Altitude: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm' : '', persist: true },
  Fix: { type: 'i', persist: true },
  NrOfSatellites: { type: 'i', persist: true },
  'Position/Latitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: true },
  'Position/Longitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: true },
  Speed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '', persist: true },
  Course: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '°' : '', persist: true },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

/**
 * Get interface description for GPS device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(gpsProperties)
  
  return { ...ifaceDesc, ...properties }
}

/**
 * Get initial interface implementation with default values
 * @param {Object} config - Node configuration
 * @returns {Object} Interface with initial values
 */
function getInterface(config) {
  const iface = { emit: function () {} }
  
  // Set initial values from properties definition
  for (const key in gpsProperties) {
    const propertyValue = { ...gpsProperties[key] }
    
    if (propertyValue.value !== undefined) {
      iface[key] = propertyValue.value
    } else {
      switch (propertyValue.type) {
        case 's':
          iface[key] = '-'
          break
        default:
          iface[key] = null
      }
    }
  }
  
  return iface
}

/**
 * Set up device-specific configuration
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface
 * @param {Object} ifaceDesc - Interface description
 * @param {Object} node - Node instance
 * @param {Object} context - Context with persistence info
 * @returns {Object} Setup result
 */
function setupDevice(config, iface, ifaceDesc, node, context) {
  // GPS doesn't have specific setup beyond the default properties
  
  return {
    success: true
  }
}

/**
 * Get status text for node display
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 * @returns {string} Status text
 */
function getStatusText(iface, config) {
  return 'Virtual GPS'
}

/**
 * Get paths that should be tracked for persistence
 * @param {Object} config - Node configuration
 * @returns {Array<string>} Paths to track
 */
function getPathsToTrack(config) {
  const persistentPaths = [];
  
  // Add CustomName by default
  persistentPaths.push('CustomName');
  
  // Add all GPS properties marked for persistence
  persistentPaths.push(...utils.getPersistentPaths(gpsProperties, config));
  
  return persistentPaths;
}

/**
 * Apply default values for this device type
 * GPS devices should NOT have default values applied
 * as it could misplace the Victron system globally
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 */
function applyDefaultValues(iface, config) {
  // GPS devices should NOT have default values applied
  // as it could misplace the Victron system globally
  // This function is intentionally empty
}

module.exports = {
  getInterfaceDescription,
  getInterface,
  setupDevice,
  getStatusText,
  getPathsToTrack,
  applyDefaultValues
}
