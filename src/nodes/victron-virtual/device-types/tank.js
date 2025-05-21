/**
 * Tank device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:tank')
const utils = require('../utils')

/**
 * Tank properties definition
 */
const tankProperties = {
  'Alarms/High/Active': { type: 'd' },
  'Alarms/High/Delay': { type: 'd' },
  'Alarms/High/Enable': { type: 'd' },
  'Alarms/High/Restore': { type: 'd' },
  'Alarms/High/State': { type: 'd' },
  'Alarms/Low/Active': { type: 'd' },
  'Alarms/Low/Delay': { type: 'd' },
  'Alarms/Low/Enable': { type: 'd' },
  'Alarms/Low/Restore': { type: 'd' },
  'Alarms/Low/State': { type: 'd' },
  Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'm3' : '', persist: true },
  FluidType: {
    type: 'i',
    format: (v) => ({
      0: 'Fuel',
      1: 'Fresh water',
      2: 'Waste water',
      3: 'Live well',
      4: 'Oil',
      5: 'Black water (sewage)',
      6: 'Gasoline',
      7: 'Diesel',
      8: 'LPG',
      9: 'LNG',
      10: 'Hydraulic oil',
      11: 'Raw water'
    }[v] || 'unknown'),
    value: 0,
    persist: true
  },
  Level: { type: 'd', format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: true },
  RawUnit: { type: 's' },
  RawValue: { type: 'd' },
  RawValueEmpty: { type: 'd' },
  RawValueFull: { type: 'd' },
  Remaining: { type: 'd', persist: true },
  Shape: { type: 's' },
  Temperature: { 
    type: 'd', 
    format: (v) => v != null ? v.toFixed(1) + 'C' : '', 
    persist: true,
    persistCondition: (config) => config.include_tank_temperature
  },
  BatteryVoltage: { 
    type: 'd', 
    value: 3.3, 
    format: (v) => v != null ? v.toFixed(2) + 'V' : '', 
    persist: true,
    persistCondition: (config) => config.include_tank_battery
  },
  Status: { type: 'i' }
}

/**
 * Get interface description for tank device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(tankProperties)
  
  // Remove optional properties if not enabled
  if (!config.include_tank_battery) {
    delete properties.BatteryVoltage
  }
  
  if (!config.include_tank_temperature) {
    delete properties.Temperature
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
  for (const key in tankProperties) {
    const propertyValue = { ...tankProperties[key] }
    
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
  if (!config.include_tank_battery) {
    delete iface.BatteryVoltage
  }
  
  if (!config.include_tank_temperature) {
    delete iface.Temperature
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
  // Set fluid type
  iface.FluidType = Number(config.fluid_type ?? 1) // Default to Fresh water
  
  // Set battery voltage if included
  if (config.include_tank_battery && config.tank_battery_voltage) {
    iface.BatteryVoltage = Number(config.tank_battery_voltage)
  }
  
  // Set tank capacity if defined
  if (config.tank_capacity !== '' && config.tank_capacity !== undefined) {
    const capacity = Number(config.tank_capacity)
    if (isNaN(capacity) || capacity <= 0) {
      node.error('Tank capacity must be greater than 0')
      return { success: false }
    }
    iface.Capacity = capacity
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
  const fluidTypeFormat = tankProperties.FluidType.format
  
  if (iface.FluidType !== undefined && fluidTypeFormat) {
    return `Virtual ${fluidTypeFormat(iface.FluidType).toLowerCase()} tank sensor`
  }
  
  return 'Virtual tank sensor'
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
  persistentPaths.push(...utils.getPersistentPaths(tankProperties, config));
  
  return persistentPaths;
}

/**
 * Apply default values for this device type
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 */
function applyDefaultValues(iface, config) {
  iface.Level = 50
  
  if (config.include_tank_temperature) {
    iface.Temperature = 25
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
