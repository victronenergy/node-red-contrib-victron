/**
 * PV inverter device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:pvinverter')
const utils = require('../utils')

/**
 * PV inverter properties definition
 */
const pvinverterProperties = {
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', persist: true },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', persist: true },
  'Ac/MaxPower': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', persist: true },
  'Ac/PowerLimit': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', persist: true },
  ErrorCode: {
    type: 'i',
    value: 0,
    format: (v) => ({
      0: 'No error'
    }[v] || 'unknown'),
    persist: true
  },
  Position: {
    type: 'i',
    format: (v) => ({
      0: 'AC input 1',
      1: 'AC output',
      2: 'AC input 2'
    }[v] || 'unknown'),
    persist: true
  },
  StatusCode: {
    type: 'i',
    format: (v) => ({
      0: 'Startup 0',
      1: 'Startup 1',
      2: 'Startup 2',
      3: 'Startup 3',
      4: 'Startup 4',
      5: 'Startup 5',
      6: 'Startup 6',
      7: 'Running',
      8: 'Standby',
      9: 'Boot loading',
      10: 'Error'
    }[v] || 'unknown'),
    persist: true
  },
  NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1, persist: true },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

/**
 * Get interface description for PV inverter device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(pvinverterProperties)
  
  // Add phase-specific properties
  const nrOfPhases = Number(config.pvinverter_nrofphases ?? 1)
  
  const phaseProperties = [
    { name: 'Current', unit: 'A' },
    { name: 'Power', unit: 'W' },
    { name: 'Voltage', unit: 'V' },
    { name: 'Energy/Forward', unit: 'kWh' }
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
  for (const key in pvinverterProperties) {
    const propertyValue = { ...pvinverterProperties[key] }
    
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
  
  // Set position and number of phases from config
  iface.Position = Number(config.position ?? 0)
  iface.NrOfPhases = Number(config.pvinverter_nrofphases ?? 1)
  
  // Add phase-specific properties with initial values
  const phaseProperties = [
    { name: 'Current', unit: 'A' },
    { name: 'Power', unit: 'W' },
    { name: 'Voltage', unit: 'V' },
    { name: 'Energy/Forward', unit: 'kWh' }
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
  // Set position and number of phases
  iface.Position = Number(config.position ?? 0)
  iface.NrOfPhases = Number(config.pvinverter_nrofphases ?? 1)
  
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
  return `Virtual ${iface.NrOfPhases}-phase pvinverter`
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
  persistentPaths.push(...utils.getPersistentPaths(pvinverterProperties, config));
  
  // Add phase-specific properties based on configuration
  const nrOfPhases = Number(config.pvinverter_nrofphases ?? 1)
  const phaseProperties = ['Current', 'Power', 'Voltage', 'Energy/Forward']
  
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
  iface['Ac/MaxPower'] = 1000
  iface['Ac/PowerLimit'] = 1000
  iface['Ac/Energy/Forward'] = 0
  iface.ErrorCode = 0
  iface.StatusCode = 0
  
  // Set default values for phase-specific properties
  const nrOfPhases = Number(config.pvinverter_nrofphases ?? 1)
  const phaseProperties = ['Current', 'Power', 'Voltage', 'Energy/Forward']
  
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
