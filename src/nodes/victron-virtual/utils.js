/**
 * Utility functions for Victron Virtual devices
 */

/**
 * Create interface description for a device
 * @param {Object} properties - Device properties object
 * @returns {Object} Interface description
 */
function createIfaceDesc (properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return {}
  }

  const result = {}

  // Deep copy the properties, including format functions
  for (const [key, value] of Object.entries(properties)) {
    result[key] = { ...value }
    if (typeof value.format === 'function') {
      result[key].format = value.format
    }
  }

  // Add common properties to all devices
  result.DeviceInstance = { type: 'i' }
  result.CustomName = { type: 's', persist: true }
  result.Serial = { type: 's', persist: true }

  return result
}

/**
 * Create device interface with default values
 * @param {Object} properties - Device properties object
 * @returns {Object} Device interface
 */
function createIface (properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return {
      emit: function () {}
    }
  }

  const result = {
    emit: function () {}
  }

  // Use the exact original logic but with debugging
  for (const key in properties) {
    const propertyValue = JSON.parse(JSON.stringify(properties[key]))

    if (propertyValue.value !== undefined) {
      result[key] = propertyValue.value
    } else {
      switch (propertyValue.type) {
        case 's':
          result[key] = '-'
          break
        default:
          result[key] = null
      }
    }

    // Safety check
    if (typeof result[key] === 'object' && result[key] !== null) {
      console.error(`ERROR: ${key} is an object:`, result[key])
    }
  }

  return result
}

module.exports = {
  createIfaceDesc,
  createIface
}
