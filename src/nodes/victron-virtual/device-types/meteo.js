/**
 * Meteo device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:meteo')
const utils = require('../utils')

/**
 * Meteo properties definition
 */
const meteoProperties = {
  Irradiance: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'W/m2' : '', persist: true },
  WindSpeed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '', persist: true },
  WindDirection: { type: 'i', persist: true }
}

/**
 * Get interface description for meteo device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(meteoProperties)
  
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
  for (const key in meteoProperties) {
    const propertyValue = { ...meteoProperties[key] }
    
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
  // No specific setup needed beyond the default configuration
  
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
  return 'Virtual meteo device'
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
  
  // Add all properties marked for persistence
  persistentPaths.push(...utils.getPersistentPaths(meteoProperties, config));
  
  return persistentPaths;
}

/**
 * Apply default values for this device type
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 */
function applyDefaultValues(iface, config) {
  iface.Irradiance = 0
  iface.WindSpeed = 0
  iface.WindDirection = 0
}

module.exports = {
  getInterfaceDescription,
  getInterface,
  setupDevice,
  getStatusText,
  getPathsToTrack,
  applyDefaultValues
}
