const { addSettings } = require('dbus-victron-virtual')
const debug = require('debug')('victron-virtual')

/**
 * Replaces any character that is not alphanumeric or underscore with '_',
 * producing a string safe for use in D-Bus object path elements and service names.
 * The original node.id is preserved for filesystem persistence.
 */
function sanitizeIdForDbus (id) {
  return id.replace(/[^A-Za-z0-9_]/g, '_')
}

/**
 * Parses NODE_RED_DBUS_ADDRESS and returns a tcp: bus address string,
 * or null if not set (caller should fall back to session/system bus).
 */
function getTcpBusAddress () {
  const parts = process.env.NODE_RED_DBUS_ADDRESS
    ? process.env.NODE_RED_DBUS_ADDRESS.split(':')
    : null
  if (parts && parts.length === 2) {
    return `tcp:host=${parts[0]},port=${parts[1]}`
  }
  return null
}

/**
 * Calls addSettings with exponential-backoff retry while the settings
 * service is temporarily unavailable (e.g. during Venus OS startup).
 */
async function callAddSettingsWithRetry (bus, settings, maxRetries = 10) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await addSettings(bus, settings)
    } catch (error) {
      const errorMessage = Array.isArray(error) ? error.join(', ') : (error?.message || String(error))
      const isServiceUnavailable =
        errorMessage.includes('org.freedesktop.DBus.Error.ServiceUnknown') ||
        errorMessage.includes('com.victronenergy.settings') ||
        errorMessage.includes('No such service') ||
        errorMessage.includes('was not provided by any .service files')

      if (!isServiceUnavailable || attempt === maxRetries - 1) throw error

      const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
      debug(`Settings service unavailable, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

/**
 * Extracts the numeric DeviceInstance from the addSettings result.
 * The result structure is an implementation detail of dbus-victron-virtual;
 * two access paths are tried for forwards/backwards compatibility.
 */
function getDeviceInstance (result) {
  try {
    const firstValue = result?.[0]?.[2]?.[1]?.[1]?.[0]?.split(':')[1]
    if (firstValue != null) {
      const number = Number(firstValue)
      if (!isNaN(number)) return number
    }
  } catch (e) {}

  try {
    const fallbackValue = result?.[1]?.[0]?.split(':')[1]
    if (fallbackValue != null) {
      const number = Number(fallbackValue)
      if (!isNaN(number)) return number
    }
  } catch (e) {}

  console.warn('Failed to extract valid DeviceInstance from settings result')
  return null
}

/**
 * Sets up the pending-input queue and registers the node's 'input' event handler.
 * Messages received before setValuesLocally is available are queued and flushed
 * once the D-Bus interface is ready (call flushPendingInputs at that point).
 */
function registerInputHandler (node, debugInput, handleInput) {
  node.pendingCallsToSetValuesLocally = []
  node.on('input', function (msg, _send, done) {
    if (!node.setValuesLocally) {
      node.pendingCallsToSetValuesLocally.push([msg, done])
      debugInput(`Node ${node.id} is not ready to handle input yet, queuing message. Pending calls: ${node.pendingCallsToSetValuesLocally.length}`)
      return
    }
    handleInput(msg, done)
  })
}

/**
 * Drains the pending-input queue built by registerInputHandler.
 * Call this once setValuesLocally is available on the node.
 */
function flushPendingInputs (node, handleInput) {
  node.pendingCallsToSetValuesLocally.forEach(([msg, done]) => {
    try {
      handleInput(msg, done)
    } catch (err) {
      node.error(`Failed to handle pending message: ${err.message}`, msg)
    }
  })
  node.pendingCallsToSetValuesLocally = []
}

/**
 * Creates per-key debounced setters that call node.setValuesLocally after a delay.
 * Also returns shouldApplyImmediately, which checks the ifaceDesc for the immediate flag.
 */
function createDebouncedSetters (node, debounce, delayMs) {
  const debouncedSetters = new Map()

  function shouldApplyImmediately (key) {
    return node.ifaceDesc?.properties?.[key]?.immediate === true
  }

  function getDebouncedSetter (key) {
    if (!debouncedSetters.has(key)) {
      debouncedSetters.set(key, debounce((value) => {
        try {
          node.setValuesLocally({ [key]: value })
        } catch (err) {
          node.error(`Failed to apply debounced value for ${key}: ${err.message}`)
        }
      }, delayMs))
    }
    return debouncedSetters.get(key)
  }

  return { shouldApplyImmediately, getDebouncedSetter }
}

module.exports = { sanitizeIdForDbus, getTcpBusAddress, callAddSettingsWithRetry, getDeviceInstance, registerInputHandler, flushPendingInputs, createDebouncedSetters }
