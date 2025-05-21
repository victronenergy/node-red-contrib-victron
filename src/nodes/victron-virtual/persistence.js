/**
 * Persistence handling for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:persistence')

/**
 * Get the persistence key for a node
 * @param {Object} node - The node instance
 * @returns {string} - Persistence key
 */
function getPersistenceKey(node) {
  return `victron-virtual-device-${node.id}`
}

/**
 * Save device state to persistent storage
 * @param {Object} node - The node instance
 * @param {string} storageType - The storage type to use
 * @param {Object} stateData - The state data to save
 */
function saveDeviceState(node, storageType, stateData) {
  if (!storageType || !stateData) return
  
  const persistenceKey = getPersistenceKey(node)
  node.context().set(persistenceKey, stateData, storageType)
  debug(`Saved device state: ${JSON.stringify(stateData)}`)
}

/**
 * Save a specific property value
 * @param {Object} node - The node instance
 * @param {string} storageType - The storage type to use
 * @param {string} propertyName - The property name
 * @param {*} value - The property value
 */
function saveProperty(node, storageType, propertyName, value) {
  if (!storageType) return
  
  const persistenceKey = getPersistenceKey(node)
  const currentData = node.context().get(persistenceKey, storageType) || {}
  
  currentData[propertyName] = value
  node.context().set(persistenceKey, currentData, storageType)
  debug(`Saved property change: ${propertyName} = ${value}`)
}

/**
 * Load saved data for a node
 * @param {Object} node - The node instance
 * @param {string} storageType - The storage type to use
 * @returns {Object|null} - The saved data or null if none
 */
function loadSavedData(node, storageType) {
  if (!storageType) return null
  
  const persistenceKey = getPersistenceKey(node)
  const savedData = node.context().get(persistenceKey, storageType)
  
  if (!savedData || Object.keys(savedData).length === 0) {
    debug('No saved data found')
    return null
  }
  
  debug(`Loaded saved data: ${JSON.stringify(savedData)}`)
  return savedData
}

/**
 * Set up automatic persistence for interface
 * Overrides the emit function to save tracked properties
 * @param {Object} iface - The device interface
 * @param {Object} node - The node instance
 * @param {string} storageType - The storage type to use
 * @param {Array<string>} pathsToTrack - Paths to automatically save
 */
function setupAutoPersistence(iface, node, storageType, pathsToTrack) {
  if (!storageType || !iface || !iface.emit) return
  
  const originalEmit = iface.emit
  
  iface.emit = function(propName, newValue) {
    // Check if this property should be persisted
    if (pathsToTrack.includes(propName)) {
      saveProperty(node, storageType, propName, newValue)
    }
    
    return originalEmit.apply(this, arguments)
  }
  
  debug(`Set up auto-persistence for ${pathsToTrack.length} properties`)
}

/**
 * Set up persistence for switch device with specialized handling
 * @param {Object} iface - The device interface
 * @param {Object} node - The node instance
 * @param {string} storageType - The storage type to use
 * @param {Object} switchData - Switch-specific data
 * @param {Object} config - Node configuration
 */
function setupSwitchPersistence(iface, node, storageType, switchData, config) {
  if (!storageType || !iface || !iface.emit) return
  
  const persistenceKey = getPersistenceKey(node)
  const originalEmit = iface.emit
  
  iface.emit = function(propName, newValue) {
    const currentData = node.context().get(persistenceKey, storageType) || {}
    
    if (!currentData.switches) {
      currentData.switches = {}
    }
    
    if (propName === 'CustomName') {
      currentData.CustomName = newValue
    }
    
    const isTrackedProperty = 
      switchData.outputKeys.includes(propName) ||
      switchData.pwmKeys.includes(propName) ||
      propName.includes('/Settings/CustomName') ||
      propName.includes('/Settings/Group');
      
    if (isTrackedProperty) {
      currentData.switches[propName] = newValue
    }
    
    node.context().set(persistenceKey, currentData, storageType)
    
    return originalEmit.apply(this, arguments)
  }
  
  debug('Set up switch-specific persistence')
}

module.exports = {
  getPersistenceKey,
  saveDeviceState,
  saveProperty,
  loadSavedData,
  setupAutoPersistence,
  setupSwitchPersistence
}
