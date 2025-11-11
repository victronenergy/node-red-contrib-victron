/**
 * This file contains various utility functions
 * and enums.
 */

const _ = require('lodash')

/**
 * Calculates a 'semi-random' identifier which is used in e.g. tracking node connection statuses.
 */
function UUID () {
  return Math.floor((1 + Math.random()) * 0x10000000).toString(16)
}

const DEFAULT_SERVICE_NAMES = {
  'input-gps': {
    gps: 'GPS Device'
  },
  'input-ess': {
    vebus: 'ESS VE.Bus',
    settings: 'ESS System Settings'
  },
  'output-ess': {
    vebus: 'ESS VE.Bus',
    settings: 'ESS System Settings'
  }
}

let SERVICES = {}
try {
  SERVICES = require('./services.json')
} catch (error) {
  console.warn('Warning: Could not load services.json, using empty services for testing')
  SERVICES = {}
}

// Service-specific wildcard mappings
const WILDCARD_MAPPINGS = {
  switch: {
    type: {
      output_1: 'Output 1',
      output_2: 'Output 2',
      output_3: 'Output 3',
      output_4: 'Output 4',
      output_5: 'Output 5',
      output_6: 'Output 6',
      output_7: 'Output 7',
      output_8: 'Output 8',
      pwm_1: 'PWM 1',
      pwm_2: 'PWM 2',
      pwm_3: 'PWM 3',
      pwm_4: 'PWM 4',
      relay_1: 'Relay 1',
      relay_2: 'Relay 2',
      relay_3: 'Solid switch',
      0: '0',
      1: '1',
      2: '2',
      3: '3' // numeric fallbacks
    }
  },
  vebus: {
    alarm: {
      LowBattery: 'Low battery alarm',
      Overload: 'Overload alarm',
      TemperatureSensor: 'Temperature sensor alarm',
      VoltageSensor: 'Voltage sensor alarm',
      PhaseRotation: 'Phase rotation alarm'
    },
    bms: {
      AllowToCharge: 'allows battery to be charged',
      AllowToDischarge: 'allows battery to be discharged',
      BmsExpected: 'VE.Bus BMS is expected',
      Error: 'VE.Bus BMS error',
      PreAlarm: 'Low cell voltage imminent',
      BmsPreAlarm: 'Low cell voltage imminent (BMS)',
      GridLost: 'Grid lost',
      HighTemperature: 'Temperature too high'
    }
  },
  multi: {
    alarm: {
      HighTemperature: 'High temperature alarm',
      HighVoltage: 'High voltage alarm',
      HighVoltageAcOut: 'High AC-out voltage alarm',
      LowSoc: 'Low state of charge alarm',
      LowTemperature: 'Low battery temperature alarm',
      LowVoltage: 'Low voltage alarm',
      LowVoltageAcOut: 'Low AC-out voltage alarm',
      Overload: 'Overload alarm',
      Ripple: 'High DC ripple alarm',
      ShortCircuit: 'Short circuit alarm'
    },
    energy: {
      AcIn1ToAcOut: 'Energy from AC-in-1 to AC-out (kWh)',
      AcIn1ToInverter: 'Energy from AC-in-1 to battery (kWh)',
      AcIn2ToAcOut: 'Energy from AC-in-2 to AC-out (kWh)',
      AcIn2ToInverter: 'Energy from AC-in-2 to battery (kWh)',
      AcOutToAcIn1: 'Energy from AC-out to AC-in-1 (kWh)',
      AcOutToAcIn2: 'Energy from AC-out to AC-in-2 (kWh)',
      InverterToAcIn1: 'Energy from battery to AC-in-1 (kWh)',
      InverterToAcIn2: 'Energy from battery to AC-in-2 (kWh)',
      InverterToAcOut: 'Energy from battery to AC-out (kWh)',
      OutToInverter: 'Energy from AC-out to battery (kWh)',
      SolarToAcIn1: 'Energy from solar to AC-in-1 (kWh)',
      SolarToAcIn2: 'Energy from solar to AC-in-2 (kWh)',
      SolarToAcOut: 'Energy from solar to AC-out (kWh)',
      SolarToBattery: 'Energy from solar to battery (kWh)'
    }
  },
  '*': {
    schedule: { 0: '1', 1: '2', 2: '3', 3: '4', 4: '5' },
    relay: { 0: '1', 1: '2', 2: '3', 3: '4' },
    tracker: { 0: '1', 1: '2', 2: '3', 3: '4' },
    historyDay: {
      0: 'today',
      1: 'yesterday'
    }
  }
}

/**
 * Expand wildcard paths against available cached paths
 * @param {Object} pathObj - Path object from services.json (may contain wildcards)
 * @param {Object} cachedPaths - Available paths from dbus cache
 * @param {string} serviceName - Service name for wildcard mappings
 * @returns {Array} Array of expanded path objects
 */
function expandWildcardPaths (pathObj, cachedPaths, serviceName) {
  if (!pathObj.path.includes('{')) {
    // No wildcards, return original if it exists
    return _.has(cachedPaths, pathObj.path) ? [pathObj] : []
  }

  const expandedPaths = []

  // Extract all wildcards from the path
  const wildcardMatches = pathObj.path.match(/\{(\w+)\}/g)
  if (!wildcardMatches) return []

  // Create regex pattern with capture groups for each wildcard
  let regexPattern = pathObj.path
  const wildcardNames = []

  wildcardMatches.forEach(match => {
    const wildcardName = match.replace(/[{}]/g, '')
    wildcardNames.push(wildcardName)
    regexPattern = regexPattern.replace(`{${wildcardName}}`, '([^/]+)')
  })

  const regex = new RegExp(`^${regexPattern}$`)

  // Find all matching paths in cache
  Object.keys(cachedPaths).forEach(cachedPath => {
    const match = cachedPath.match(regex)
    if (match) {
      const expandedPath = {
        ...pathObj,
        path: cachedPath
      }

      // Update name with wildcard substitutions
      let displayName = pathObj.name || ''

      wildcardNames.forEach((wildcardName, index) => {
        const wildcardValue = match[index + 1] // +1 because match[0] is full match
        let mappedValue = wildcardValue

        // Try service-specific mapping first
        const serviceMapping = _.get(WILDCARD_MAPPINGS, [serviceName, wildcardName, wildcardValue])
        if (serviceMapping) {
          mappedValue = serviceMapping
        } else {
          // Fallback to universal mapping
          const universalMapping = _.get(WILDCARD_MAPPINGS, ['*', wildcardName, wildcardValue])
          if (universalMapping) {
            mappedValue = universalMapping
          }
        }

        // For switches, try custom names (only for 'type' wildcard)
        if (serviceName === 'switch' && wildcardName === 'type') {
          const customNamePath = `/SwitchableOutput/${wildcardValue}/Settings/CustomName`
          const namePath = `/SwitchableOutput/${wildcardValue}/Name`
          const customName = cachedPaths[customNamePath] || cachedPaths[namePath]

          if (customName && customName.trim()) {
            mappedValue = customName.trim()
          }
        }

        displayName = displayName.replace(`{${wildcardName}}`, mappedValue)
      })

      expandedPath.name = displayName
      expandedPaths.push(expandedPath)
    }
  })

  return expandedPaths
}

/**
 * Node status codes.
 */
const CONNECTED = { fill: 'green', shape: 'dot', text: 'connected' }
const DISCONNECTED = { fill: 'red', shape: 'ring', text: 'disconnected' }
const MIGRATE = { fill: 'blue', shape: 'dot', text: 'please migrate' }

/**
 * Constructs a node config object that is
 * used to render node-specific editable options in UI.
 */
const TEMPLATE = (service, name, deviceInstance, paths) => {
  return {
    service: `${service}`,
    name: `${name}`,
    deviceInstance: `${deviceInstance}`,
    paths
  }
}

/**
 * Shown in the UI if the system relay mode is set to any other than 'manual'
 */
const RELAY_MODE_WARNING = (func) =>
  `The relay is configured for <strong>${func}</strong> function. Please navigate to Settings > Integrations > Relays and change it to manual.`

/**
 * All possible system relay functions
 */
const RELAY_FUNCTIONS = {
  0: 'alarm',
  1: 'generator',
  2: 'manual',
  3: 'tank pump'
}

/**
 * Internal dbus-listener status codes
 */
const STATUS = {
  SERVICE_ADD: 1,
  SERVICE_REMOVE: 2,
  PATH_ADD: 3,
  PATH_REMOVE: 4,
  PROVIDER_STATUS: 5,
  PROVIDER_ERROR: 6,
  PLUGIN_ERROR: 7,
  SERVICE_MIGRATE: 8
}

/**
  * Maps a cache value to a JSON-serializable value.
  * - Strings, numbers, booleans, and null are returned as-is.
  * - Dates are converted to ISO strings.
  * - Objects and arrays are stringified.
  * - Other types (e.g., functions) are converted to their string representation.
*/
function mapCacheValueToJsonResponseValue (value) {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'function') return value.toString()
  return value
}

/**
  * Maps the cache (see VictronClient.system.cache) to a JSON string.
  */
function mapCacheToJsonResponse (cache) {
  const result = {}
  for (const [device, value] of Object.entries(cache)) {
    result[device] = {}
    for (const [path, pathValue] of Object.entries(value)) {
      result[device][path] = mapCacheValueToJsonResponseValue(pathValue)
    }
  }
  return JSON.stringify(result)
}

/**
 * Validates that a payload object is valid for setting virtual device values
 * @param {any} payload - The payload to validate
 * @returns {{ valid: boolean, error?: string, invalidKeys?: string[] }}
 */
function validateVirtualDevicePayload (payload) {
  // Check if payload is an object
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    const receivedType = Array.isArray(payload) ? 'array' : typeof payload
    return {
      valid: false,
      error: `Invalid payload type: ${receivedType}. Expected: JavaScript object with at least one property/value.`
    }
  }

  // Check if object is empty
  if (Object.keys(payload).length === 0) {
    return {
      valid: false,
      error: 'Received empty object. Expected: JavaScript object with at least one property/value.'
    }
  }

  // Check if all values are valid types (string, number, boolean, null, or array of numbers)
  const invalidEntries = Object.entries(payload).filter(([key, value]) => {
    if (value === null) return false
    if (typeof value === 'string') return false
    if (typeof value === 'number') return false
    if (typeof value === 'boolean') return false
    if (Array.isArray(value)) {
      // Arrays are valid (for LightControls), but should contain only numbers
      return !value.every(item => typeof item === 'number')
    }
    return true
  })

  if (invalidEntries.length > 0) {
    const invalidKeys = invalidEntries.map(([key]) => key).join(', ')
    return {
      valid: false,
      error: `Invalid value types for keys: ${invalidKeys}. Expected: string, number, boolean, null, or array of numbers.`,
      invalidKeys: invalidEntries.map(([key]) => key)
    }
  }

  return { valid: true }
}

/**
 * Validates LightControls array for RGB control types
 * @param {any} value - The LightControls value to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLightControls (value) {
  // Check if value is an array
  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: 'LightControls must be an array of exactly 5 integers'
    }
  }

  // Check array length
  if (value.length !== 5) {
    return {
      valid: false,
      error: `LightControls must have exactly 5 elements, got ${value.length}`
    }
  }

  // Validate each element: [Hue(0-360), Saturation(0-100), Brightness(0-100), White(0-100), ColorTemperature(0-6500)]
  const [hue, saturation, brightness, white, colorTemp] = value
  const constraints = [
    { name: 'Hue', value: hue, min: 0, max: 360, index: 0 },
    { name: 'Saturation', value: saturation, min: 0, max: 100, index: 1 },
    { name: 'Brightness', value: brightness, min: 0, max: 100, index: 2 },
    { name: 'White', value: white, min: 0, max: 100, index: 3 },
    { name: 'ColorTemperature', value: colorTemp, min: 0, max: 6500, index: 4 }
  ]

  // Check all elements are integers and within range
  const invalidElements = constraints.filter(c =>
    !Number.isInteger(c.value) || c.value < c.min || c.value > c.max
  )

  if (invalidElements.length > 0) {
    const errors = invalidElements.map(c =>
      `${c.name}[${c.index}]=${c.value} (valid range: ${c.min}-${c.max})`
    ).join(', ')
    return {
      valid: false,
      error: `Invalid LightControls values: ${errors}`
    }
  }

  return { valid: true }
}

/**
 * Debounces a function so that it is called only after the specified
 * delay has passed since the last invocation. Each new call resets the timer.
 * If multiple calls are made, only the last call's arguments are used.
 */
function debounce (func, delayInMs) {
  let timeout = null
  let lastThis = null
  let lastArgs = null

  return function (...args) {
    lastThis = this
    lastArgs = args

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func.apply(lastThis, lastArgs)
      timeout = null
      lastThis = null
      lastArgs = null
    }, delayInMs)
  }
}

/**
 * Throttles a function so that it is called at most once
 * in the specified limitInMs interval. Calls at the trailing edge.
 * If multiple calls are made during the throttle period,
 * only the last call's arguments are used when the period ends.
 * Compare https://stackoverflow.com/a/73842701/748139
 */
function throttle (func, limitInMs) {
  let lastThis = null
  let lastArgs = null
  let lastTimeout = null

  return function (...args) {
    lastThis = this
    lastArgs = args
    if (!lastTimeout) {
      lastTimeout = setTimeout(() => {
        func.apply(lastThis, lastArgs)
        lastTimeout = null
        lastThis = null
        lastArgs = null
      }, limitInMs)
    }
  }
}

module.exports = {
  CONNECTED,
  DISCONNECTED,
  MIGRATE,
  RELAY_FUNCTIONS,
  RELAY_MODE_WARNING,
  SERVICES,
  STATUS,
  TEMPLATE,
  UUID,
  DEFAULT_SERVICE_NAMES,
  WILDCARD_MAPPINGS,
  expandWildcardPaths,
  mapCacheValueToJsonResponseValue,
  mapCacheToJsonResponse,
  validateVirtualDevicePayload,
  validateLightControls,
  debounce,
  throttle
}
