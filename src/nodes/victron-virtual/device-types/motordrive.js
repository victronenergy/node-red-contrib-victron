/**
 * Motor Drive device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:motordrive')
const utils = require('../utils')

/**
 * Motor Drive properties definition
 */
const motordriveProperties = {
  'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', persist: true },
  'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', persist: true },
  'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: true },
  'Controller/Temperature': { 
    type: 'd', 
    format: (v) => v != null ? v.toFixed(1) + 'C' : '', 
    persist: true,
    persistCondition: (config) => config.include_controller_temp
  },
  'Coolant/Temperature': { 
    type: 'd', 
    format: (v) => v != null ? v.toFixed(1) + 'C' : '', 
    persist: true,
    persistCondition: (config) => config.include_coolant_temp
  },
  'Motor/Temperature': { 
    type: 'd', 
    format: (v) => v != null ? v.toFixed(1) + 'C' : '', 
    persist: true,
    persistCondition: (config) => config.include_motor_temp
  },
  'Motor/RPM': { 
    type: 'd', 
    format: (v) => v != null ? v.toFixed(0) + 'RPM' : '', 
    persist: true,
    persistCondition: (config) => config.include_motor_rpm
  },
  'Motor/Direction': {
    type: 'i',
    format: (v) => ({
      0: 'Neutral',
      1: 'Reverse',
      2: 'Forward'
    }[v] || 'unknown'),
    value: 0,
    persist: true,
    persistCondition: (config) => config.include_motor_direction
  },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

/**
 * Get interface description for motor drive device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(motordriveProperties)
  
  // Remove optional properties if not enabled
  if (!config.include_motor_temp) {
    delete properties['Motor/Temperature']
  }
  
  if (!config.include_controller_temp) {
    delete properties['Controller/Temperature']
  }
  
  if (!config.include_coolant_temp) {
    delete properties['Coolant/Temperature']
  }
  
  if (!config.include_motor_rpm) {
    delete properties['Motor/RPM']
  }
  
  if (!config.include_motor_direction) {
    delete properties['Motor/Direction']
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
  for (const key in motordriveProperties) {
    const propertyValue = { ...motordriveProperties[key] }
    
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
  if (!config.include_motor_temp) {
    delete iface['Motor/Temperature']
  }
  
  if (!config.include_controller_temp) {
    delete iface['Controller/Temperature']
  }
  
  if (!config.include_coolant_temp) {
    delete iface['Coolant/Temperature']
  }
  
  if (!config.include_motor_rpm) {
    delete iface['Motor/RPM']
  }
  
  if (!config.include_motor_direction) {
    delete iface['Motor/Direction']
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
  let text = 'Virtual motor drive';
  
  // Add RPM and Direction to the status text if they are enabled
  if (config.include_motor_rpm || config.include_motor_direction) {
    text += ' with';
    if (config.include_motor_rpm) text += ' RPM';
    if (config.include_motor_rpm && config.include_motor_direction) text += ' and';
    if (config.include_motor_direction) text += ' direction';
  }
  
  return text;
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
  persistentPaths.push(...utils.getPersistentPaths(motordriveProperties, config));
  
  return persistentPaths;
}

/**
 * Apply default values for this device type
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 */
function applyDefaultValues(iface, config) {
  iface['Dc/0/Current'] = 0
  iface['Dc/0/Voltage'] = 48
  iface['Dc/0/Power'] = 0

  if (config.include_motor_temp) {
    iface['Motor/Temperature'] = 30
  }
  
  if (config.include_controller_temp) {
    iface['Controller/Temperature'] = 35
  }
  
  if (config.include_coolant_temp) {
    iface['Coolant/Temperature'] = 40
  }
  
  if (config.include_motor_rpm) {
    iface['Motor/RPM'] = 0
  }
  
  if (config.include_motor_direction) {
    iface['Motor/Direction'] = 0 // Neutral
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
