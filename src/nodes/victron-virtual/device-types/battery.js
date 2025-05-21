/**
 * Battery device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:battery')
const utils = require('../utils')

/**
 * Battery properties definition
 */
const batteryProperties = {
  Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'Ah' : '', persist: true },
  'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', persist: true },
  'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', persist: true },
  'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: true },
  'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: true },
  'Info/BatteryLowVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: true },
  'Info/MaxChargeVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: true },
  'Info/MaxChargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', persist: true },
  'Info/MaxDischargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', persist: true },
  'Info/ChargeRequest': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  Soc: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: true },
  Soh: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: true },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  'Alarms/CellImbalance': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighChargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighDischargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/InternalFailure': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/LowCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/LowSoc': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/LowTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/LowVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/StateOfHealth': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  NrOfDistributors: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'System/MinCellVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'V' : '', persist: true }
}

/**
 * Get interface description for battery device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(batteryProperties)
  
  // Remove temperature property if not included
  if (!config.include_battery_temperature) {
    delete properties['Dc/0/Temperature']
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
  for (const key in batteryProperties) {
    const propertyValue = { ...batteryProperties[key] }
    
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
  
  // Remove temperature property if not included
  if (!config.include_battery_temperature) {
    delete iface['Dc/0/Temperature']
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
  // Set battery capacity if provided
  if (config.battery_capacity != null && !isNaN(Number(config.battery_capacity))) {
    iface.Capacity = Number(config.battery_capacity)
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
  if (iface.Capacity) {
    return `Virtual ${iface.Capacity.toFixed(0)}Ah battery`
  }
  return 'Virtual battery'
}

/**
 * Get paths that should be tracked for persistence
 * @param {Object} config - Node configuration
 * @returns {Array<string>} Paths to track
 */
function getPathsToTrack(config) {
  const persistentPaths = [];
  
  // Add CustomName by default - it's a standard property for all devices
  persistentPaths.push('CustomName');
  
  // Add all properties marked for persistence
  for (const [key, prop] of Object.entries(batteryProperties)) {
    if (prop.persist && (key !== 'Dc/0/Temperature' || config.include_battery_temperature)) {
      persistentPaths.push(key);
    }
  }
  
  return persistentPaths;
}

/**
 * Apply default values for this device type
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 */
function applyDefaultValues(iface, config) {
  iface['Dc/0/Current'] = 0
  iface['Dc/0/Voltage'] = 24
  iface['Dc/0/Power'] = 0
  if (config.include_battery_temperature) {
    iface['Dc/0/Temperature'] = 25
  }
  iface.Soc = 80
  iface.Soh = 100
  iface['System/MinCellVoltage'] = 3.3
}

module.exports = {
  getInterfaceDescription,
  getInterface,
  setupDevice,
  getStatusText,
  getPathsToTrack,
  applyDefaultValues
}
