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
 * Keys that share a debounceGroup in the ifaceDesc are applied together in one call.
 * Also returns shouldApplyImmediately, which checks the ifaceDesc for the immediate flag, and
 * applyInput, which applies a node input payload: immediate keys now, the rest debounced.
 */
function createDebouncedSetters (node, debounce, delayMs) {
  const groupSetters = new Map()

  // Payload keys may carry a leading slash ('/Position/Latitude'), ifaceDesc keys do not
  function normalize (key) {
    return key.startsWith('/') ? key.substring(1) : key
  }

  function propertyOf (key) {
    return node.ifaceDesc?.properties?.[normalize(key)]
  }

  function shouldApplyImmediately (key) {
    return propertyOf(key)?.immediate === true
  }

  // Values arriving within the delay are merged, so a group updated across several messages
  // still lands on D-Bus as a single ItemsChanged signal. Updates that keep arriving within the
  // delay are applied at least every maxWaitMs, so they can't postpone the group forever.
  const maxWaitMs = 5 * delayMs

  function getDebouncedSetterForMultipleProps (group) {
    if (!groupSetters.has(group)) {
      let pending = {}
      let maxWaitTimer = null
      const apply = () => {
        clearTimeout(maxWaitTimer)
        maxWaitTimer = null
        const values = pending
        if (Object.keys(values).length === 0) return
        pending = {}
        try {
          node.setValuesLocally(values)
        } catch (err) {
          node.error(`Failed to apply debounced value for ${Object.keys(values).join(', ')}: ${err.message}`)
        }
      }
      const flush = debounce(apply, delayMs)
      groupSetters.set(group, (values) => {
        // A changed debounceBoundary value (e.g. an EV charger Status) is a transition: values
        // from earlier messages go first, so they are not merged into it
        const isTransition = Object.entries(values).some(([key, value]) =>
          propertyOf(key)?.debounceBoundary && value !== (key in pending ? pending[key] : node.iface?.[normalize(key)]))
        if (isTransition) apply()
        Object.assign(pending, values)
        if (!maxWaitTimer) maxWaitTimer = setTimeout(apply, maxWaitMs)
        flush()
      })
    }
    return groupSetters.get(group)
  }

  // A key without a debounceGroup is a group of its own
  function groupOf (key) {
    const group = propertyOf(key)?.debounceGroup
    return group ? `group:${group}` : `key:${key}`
  }

  function getDebouncedSetter (key) {
    const setGroup = getDebouncedSetterForMultipleProps(groupOf(key))
    return (value) => setGroup({ [key]: value })
  }

  // The keys of one group in a payload are handed over together, so a debounceBoundary key
  // can't split them
  function applyInput (payload) {
    const immediate = {}
    const groups = new Map()
    for (const [key, value] of Object.entries(payload)) {
      if (shouldApplyImmediately(key)) {
        immediate[key] = value
      } else {
        const group = groupOf(key)
        if (!groups.has(group)) groups.set(group, {})
        groups.get(group)[key] = value
      }
    }
    if (Object.keys(immediate).length > 0) node.setValuesLocally(immediate)
    groups.forEach((values, group) => getDebouncedSetterForMultipleProps(group)(values))
  }

  return { shouldApplyImmediately, getDebouncedSetter, applyInput }
}

/**
 * Names of the persisted properties in an ItemsChanged payload. One signal can carry several
 * changed properties (e.g. when onPropertiesChanged adds calculated values), so check them all.
 */
function getPersistedChangedProps (items, ifaceDesc) {
  return items
    .map(([path]) => path.substring(1))
    .filter(propName => ifaceDesc.properties[propName]?.persist)
}

module.exports = { sanitizeIdForDbus, getTcpBusAddress, callAddSettingsWithRetry, getDeviceInstance, registerInputHandler, flushPendingInputs, createDebouncedSetters, getPersistedChangedProps }
