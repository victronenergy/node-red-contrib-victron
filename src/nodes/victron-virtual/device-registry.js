/**
 * Device registry for tracking and managing Victron Virtual node instances
 */
const debug = require('debug')('victron-virtual:registry')

// Registry state
const nodeInstances = new Set()
let hasRunOnce = false
let cleanupTimeoutHandle = null

/**
 * Register a device node instance
 * @param {Object} node - The node instance
 */
function registerDevice(node) {
  nodeInstances.add(node)
  debug(`Registered device: ${node.id}, total count: ${nodeInstances.size}`)
}

/**
 * Unregister a device node instance
 * @param {Object} node - The node instance
 */
function unregisterDevice(node) {
  nodeInstances.delete(node)
  debug(`Unregistered device: ${node.id}, remaining count: ${nodeInstances.size}`)
}

/**
 * Check if the current node is the last instance
 * @returns {boolean} - True if it's the last/only instance
 */
function isLastInstance() {
  return nodeInstances.size === 0
}

/**
 * Schedule cleanup of inactive devices
 * This will run only once when the first node is registered
 * @param {Object} bus - The dbus instance
 * @param {Function} removeSettings - Function to remove settings
 */
function scheduleCleanup(bus, removeSettings) {
  if (!hasRunOnce && cleanupTimeoutHandle === null) {
    cleanupTimeoutHandle = setTimeout(() => {
      cleanupInactiveDevices(bus, removeSettings)
      .then(() => {
        hasRunOnce = true
        cleanupTimeoutHandle = null
      })
      .catch(err => {
        debug(`Error during cleanup: ${err}`)
        hasRunOnce = true
        cleanupTimeoutHandle = null
      })
    }, 10000) // 10 seconds delay before cleanup
  }
}

/**
 * Clean up inactive devices
 * @param {Object} bus - The dbus instance
 * @param {Function} removeSettings - Function to remove settings
 * @returns {Promise} - Promise that resolves when cleanup is complete
 */
async function cleanupInactiveDevices(bus, removeSettings) {
  debug('Checking for old virtual devices')
  
  if (!removeSettings) {
    debug('No removeSettings function available, skipping cleanup')
    return
  }
  
  try {
    // Get all devices from the settings
    const getValueResult = await bus.callMethod({
      path: '/Settings/Devices',
      interface: 'com.victronenergy.BusItem',
      destination: 'com.victronenergy.settings',
      member: 'GetValue'
    })
    
    if (getValueResult && getValueResult[1] && Array.isArray(getValueResult[1])) {
      const deviceEntries = getValueResult[1][0]
      
      // Get all virtual devices
      const virtualDevices = deviceEntries
        .filter(entry => {
          const path = entry[0]
          return typeof path === 'string' &&
                 path.includes('virtual_') &&
                 path.includes('ClassAndVrmInstance')
        })
        .map(entry => entry[0].split('/')[0])
      
      // Filter out devices that belong to active nodes
      const activeNodeIds = Array.from(nodeInstances).map(node => node.id)
      const devicesToRemove = virtualDevices.filter(devicePath => {
        return !activeNodeIds.some(nodeId => devicePath.includes(nodeId))
      })
      
      debug('Devices to remove (no active nodes):', devicesToRemove)
      
      // Remove settings for each inactive virtual device
      if (devicesToRemove.length > 0) {
        // Try removing each device individually to better handle errors
        for (const device of devicesToRemove) {
          const path = `/Settings/Devices/${device}/ClassAndVRMInstance`
          debug('Attempting to remove:', path)
          
          try {
            const result = await removeSettings([{ path }])
            debug('Remove result for', path, ':', result)
          } catch (err) {
            debug('Error removing', path, ':', err)
          }
        }
      }
    }
  } catch (err) {
    debug('Error during cleanup:', err)
  }
}

/**
 * Reset registry state - mainly for testing
 */
function resetRegistryState() {
  nodeInstances.clear()
  hasRunOnce = false
  
  if (cleanupTimeoutHandle) {
    clearTimeout(cleanupTimeoutHandle)
    cleanupTimeoutHandle = null
  }
}

module.exports = {
  registerDevice,
  unregisterDevice,
  isLastInstance,
  scheduleCleanup,
  cleanupInactiveDevices,
  resetRegistryState
}
