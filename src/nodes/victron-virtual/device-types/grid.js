/**
 * Grid meter device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:grid')
const utils = require('../utils')

/**
 * Grid properties definition
 */
const gridProperties = {
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0, persist: true },
  'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0, persist: true },
  'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'Hz' : '', persist: true },
  'Ac/N/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', persist: true },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', persist: true },
  NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1, persist: true },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

/**
 * Get interface description for grid device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(gridProperties)
  
  // Add phase-specific properties
  const nrOfPhases = Number(config.grid_nrofphases ?? 1)
  
  const phaseProperties = [
    { name: 'Current', unit: 'A' },
    { name: 'Power', unit: 'W' },
    { name: 'Voltage', unit: 'V' },
    { name: 'Energy/Forward', unit: 'kWh' },
    { name: 'Energy/Reverse', unit: 'kWh' }
  ]
  
  for (let i = 1; i <= nrOfPhases; i++) {
    const phase = `L${i}`
    phaseProperties.forEach(({ name, unit }) => {
      const key = `Ac/${phase}/${name}`
      properties[key] = {
        type: 'd',
        format: (v) => v != null ? v.toFixed(2) + unit : '',
        persist: true
      }
    })
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
  for (const key in gridProperties) {
    const propertyValue = { ...gridProperties[key] }
    
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
  
  // Set the number of phases
  iface.NrOfPhases = Number(config.grid_nrofphases ?? 1)
  
  // Add phase-specific properties with initial values
  const phaseProperties = [
    { name: 'Current', unit: 'A' },
    { name: 'Power', unit: 'W' },
    { name: 'Voltage', unit: 'V' },
    { name: 'Energy/Forward', unit: 'kWh' },
    { name: 'Energy/Reverse', unit: 'kWh' }
  ]
  
  for (let i = 1; i <= iface.NrOfPhases; i++) {
    const phase = `L${i}`
    phaseProperties.forEach(({ name }) => {
      const key = `Ac/${phase}/${name}`
      iface[key] = 0
    })
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
  // Set the number of phases
  iface.NrOfPhases = Number(config.grid_nrofphases ?? 1)
  
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
  return `Virtual ${iface.NrOfPhases}-phase grid meter`
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
  
  // Add phase-independent properties marked for persistence
  persistentPaths.push(...utils.getPersistentPaths(gridProperties, config));
  
  // Add phase-specific properties based on configuration
  const nrOfPhases = Number(config.grid_nrofphases ?? 1)
  const phaseProperties = ['Current', 'Power', 'Voltage', 'Energy/Forward', 'Energy/Reverse']
  
  for (let i = 1; i <= nrOfPhases; i++) {
    const phase = `L${i}`
    phaseProperties.forEach(name => {
      persistentPaths.push(`Ac/${phase}/${name}`);
    })
  }
  
  return persistentPaths;
}

/**
 * Apply default values for this device type
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 */
function applyDefaultValues(iface, config) {
  iface['Ac/Power'] = 0
  iface['Ac/Frequency'] = 50
  iface['Ac/N/Current'] = 0
  
  // Set default values for phase-specific properties
  const nrOfPhases = Number(config.grid_nrofphases ?? 1)
  const phaseProperties = ['Current', 'Power', 'Voltage', 'Energy/Forward', 'Energy/Reverse']
  
  for (let i = 1; i <= nrOfPhases; i++) {
    const phase = `L${i}`
    phaseProperties.forEach(name => {
      iface[`Ac/${phase}/${name}`] = 0
    })
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
