/**
 * Temperature device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:temperature')
const utils = require('../utils')

/**
 * Temperature properties definition
 */
const temperatureProperties = {
  Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: true },
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
    }[v] || 'unknown'),
    persist: true
  },
  Pressure: { 
    type: 'd', 
    format: (v) => v != null ? v.toFixed(0) + 'hPa' : '', 
    persist: true,
    persistCondition: (config) => config.include_pressure
  },
  Humidity: { 
    type: 'd', 
    format: (v) => v != null ? v.toFixed(1) + '%' : '', 
    persist: true,
    persistCondition: (config) => config.include_humidity
  },
  BatteryVoltage: { 
    type: 'd', 
    value: 3.3, 
    format: (v) => v != null ? v.toFixed(2) + 'V' : '', 
    persist: true,
    persistCondition: (config) => config.include_temp_battery
  },
  Status: { type: 'i' }
}

/**
 * Get interface description for temperature device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(temperatureProperties)
  
  // Remove optional properties if not enabled
  if (!config.include_humidity) {
    delete properties.Humidity
  }
  
  if (!config.include_pressure) {
    delete properties.Pressure
  }
  
  if (!config.include_temp_battery) {
    delete properties.BatteryVoltage
  }
  
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
  for (const key in temperatureProperties) {
    const propertyValue = { ...temperatureProperties[key] }
    
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
  
  // Remove optional properties if not enabled
  if (!config.include_humidity) {
    delete iface.Humidity
  }
  
  if (!config.include_pressure) {
    delete iface.Pressure
  }
  
  if (!config.include_temp_battery) {
    delete iface.BatteryVoltage
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
  // Set temperature type
  iface.TemperatureType = Number(config.temperature_type ?? 2) // Default to Generic=2
  
  // Set battery voltage if included
  if (config.include_temp_battery && config.temp_battery_voltage) {
    iface.BatteryVoltage = Number(config.temp_battery_voltage)
  }
  
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
  const type = temperatureProperties.TemperatureType.format(iface.TemperatureType).toLowerCase();
  return `Virtual ${type} temperature sensor`
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
  
  // Add properties marked for persistence based on config
  persistentPaths.push(...utils.getPersistentPaths(temperatureProperties, config));
  
  return persistentPaths;
}

/**
 * Apply default values for this device type
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 */
function applyDefaultValues(iface, config) {
  iface.Temperature = 25
  
  if (config.include_humidity) {
    iface.Humidity = 50
  }
  
  if (config.include_pressure) {
    iface.Pressure = 1013
  }
}

module.exports = {
  getInterfaceDescription,
  getInterface,
  setupDevice,
  getStatusText,
  getPathsToTrack,
  applyDefaultValues
}
