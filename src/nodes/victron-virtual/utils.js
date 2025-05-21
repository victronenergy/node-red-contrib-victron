/**
 * Utility functions for the Victron Virtual node
 */
const debug = require('debug')('victron-virtual:utils')

/**
 * Find a persistent storage option in RED settings
 * @param {Object} RED - The Node-RED runtime object
 * @returns {string|null} - Storage key or null if not found
 */
function findPersistentStorage(RED) {
  const availableStorageModules = RED.settings.contextStorage || {}
  const fileStorageKey = Object.keys(availableStorageModules).find(
    key => availableStorageModules[key].module === 'localfilesystem'
  )
  
  return fileStorageKey || null
}

/**
 * Extract device instance from the settings result
 * @param {Array} result - The result from addSettings
 * @returns {number|null} - The deviceInstance or null if invalid
 */
function extractDeviceInstance(result) {
  try {
    const firstValue = result?.[0]?.[2]?.[1]?.[1]?.[0]?.split(':')[1]
    if (firstValue != null) {
      const number = Number(firstValue)
      if (!isNaN(number)) {
        return number
      }
    }
  } catch (e) {
    debug('Error extracting device instance from primary path:', e)
  }

  try {
    const fallbackValue = result?.[1]?.[0]?.split(':')[1]
    if (fallbackValue != null) {
      const number = Number(fallbackValue)
      if (!isNaN(number)) {
        return number
      }
    }
  } catch (e) {
    debug('Error extracting device instance from fallback path:', e)
  }

  debug('Failed to extract valid DeviceInstance from settings result')
  return null
}

/**
 * Collect state data from interface for properties in pathsToTrack
 * @param {Object} iface - The device interface
 * @param {Array<string>} pathsToTrack - Array of property paths to collect
 * @returns {Object} - Object with property values
 */
function collectStateData(iface, pathsToTrack) {
  const stateData = {}
  
  pathsToTrack.forEach(path => {
    if (path in iface) {
      stateData[path] = iface[path]
    }
  })
  
  return stateData
}

/**
 * Apply saved state data to interface
 * @param {Object} iface - The device interface
 * @param {Object} stateData - Object with property values
 * @param {Array<string>} pathsToTrack - Array of property paths to apply (optional)
 * @returns {boolean} - True if any data was applied
 */
function applyStateData(iface, stateData, pathsToTrack) {
  if (!stateData || Object.keys(stateData).length === 0) {
    return false
  }
  
  let appliedAny = false
  
  Object.entries(stateData).forEach(([key, value]) => {
    // If pathsToTrack is provided, only apply values for paths in it
    if (!pathsToTrack || pathsToTrack.includes(key)) {
      if (key in iface) {
        iface[key] = value
        debug(`Applied saved value for ${key}: ${value}`)
        
        // Call emit if it exists to trigger any observers
        if (typeof iface.emit === 'function') {
          iface.emit(key, value)
        }
        
        appliedAny = true
      }
    }
  })
  
  return appliedAny
}

/**
 * Creates a common interface description object with standard properties
 * @returns {Object} Base interface description
 */
function createBaseInterfaceDescription() {
  return {
    DeviceInstance: { type: 'i' },
    CustomName: { type: 's' },
    Serial: { type: 's' }
  }
}

/**
 * Deep clone an object including functions
 * @param {Object} obj - The object to clone
 * @returns {Object} - Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  const result = {}
  
  for (const [key, value] of Object.entries(obj)) {
    result[key] = { ...value }
    if (typeof value.format === 'function') {
      result[key].format = value.format
    }
  }
  
  return result
}

/**
 * Extract paths that should be persisted from property definitions
 * @param {Object} properties - Property definitions with persist flag
 * @param {Object} config - Node configuration for conditional properties
 * @returns {Array<string>} - Array of property paths to persist
 */
function getPersistentPaths(properties, config = {}) {
  const persistentPaths = [];
  
  // Add all properties marked for persistence
  for (const [key, prop] of Object.entries(properties)) {
    if (prop.persist) {
      // If there's a condition function, check if it passes
      if (prop.persistCondition && typeof prop.persistCondition === 'function') {
        if (prop.persistCondition(config)) {
          persistentPaths.push(key);
        }
      } else {
        persistentPaths.push(key);
      }
    }
  }
  
  return persistentPaths;
}

module.exports = {
  findPersistentStorage,
  extractDeviceInstance,
  collectStateData,
  applyStateData,
  createBaseInterfaceDescription,
  deepClone,
  getPersistentPaths
}