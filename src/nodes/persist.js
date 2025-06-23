const fs = require('fs')
const path = require('path')
const debug = require('debug')('victron-virtual:persistence')

function getFsLocation (RED) {
  const FS_DEFAULT_LOCATION = process.env.PERSISTED_STATE_LOCATION || path.join(RED.settings.userDir, '/.victron')

  if (RED.settings && RED.settings.victronVirtual && RED.settings.victronVirtual.persistLocation) {
    return RED.settings.victronVirtual.persistLocation
  }
  return FS_DEFAULT_LOCATION
}

function needsPersistedState (ifaceDesc) {
  if (!ifaceDesc || !ifaceDesc.properties) {
    throw new Error('Invalid interface description provided')
  }
  for (const key in ifaceDesc.properties) {
    if (ifaceDesc.properties[key].persist) {
      return true
    }
  }
  return false
}

function hasPersistedState (RED, id) {
  // ensure the directory exists
  const location = getFsLocation(RED)
  if (!fs.existsSync(location)) {
    fs.mkdirSync(location, { recursive: true })
  }

  const fname = `${location}/${id}.json`
  return fs.existsSync(fname)
}

async function loadPersistedState (RED, id, iface, ifaceDesc) {
  const fname = `${getFsLocation(RED)}/${id}.json`

  if (!fs.existsSync(fname)) {
    throw new Error(`Persisted state file for ${id} does not exist at ${fname}`)
  }

  try {
    const data = fs.readFileSync(fname, 'utf8')
    const { state } = JSON.parse(data)

    for (const key in ifaceDesc.properties) {
      if (state[key] !== undefined && ifaceDesc.properties[key].persist) {
        iface[key] = state[key]
      }
    }
  } catch (error) {
    console.error(`Error loading persisted state for ${id}:`, error)
  }
}

const timers = {} // we keep track of all timers, indexed by id

const lastSaveAt = {} // we keep track of the last save time for each id

/**
  * Sets up a timer to write the persisted state later if needed.
  * If we do write later, we return true, false otherwise.
  */
function setupToWriteLater (RED, id, iface, ifaceDesc, propName) {
  if (!propName) {
    return false // No debounce if no property name is provided, we always write immediately
  }

  const propDesc = ifaceDesc.properties[propName]
  if (propDesc && typeof propDesc.persist === 'number') {
    // If throttle is set, we debounce the save

    const now = Date.now()
    const millis = propDesc.persist * 1_000

    if (!lastSaveAt[id] || (now - lastSaveAt[id]) >= millis) {
      debug(`Writing immediately, last save was more than ${millis} ms ago, lastSavedAt=${lastSaveAt[id]}, now=${now}, id=${id}, property ${propName}`)
      return false // write now, we wrote more than millis ago
    }

    if (timers[id] && timers[id].at < lastSaveAt[id] + millis) {
      // we leave the timer in place.
      debug(`Writing now, last save was at ${lastSaveAt[id]}, millis=${millis}, id=${id}, property ${propName}`)
      return true
    } else {
      // clear the existing timer, and setup new one
      if (timers[id]) {
        clearTimeout(timers[id].timeout)
      }
      const at = lastSaveAt[id] + millis
      timers[id] = {
        timeout: setTimeout(() => {
          delete timers[id] // Clear the timer after it runs
          debug(`Writing persisted state for ${id} after a delay of ${at - now} millis, property ${propName}`)
          savePersistedState(RED, id, iface, ifaceDesc)
        }, at - now),
        at
      }
      return true
    }
  } else {
    debug(`No delayed persist set for property ${propName}, id=${id}`)
    return false // Not writing later, we write immediately
  }
}

const savedStateCache = {} // Cache for saved state to avoid redundant writes, indexed by id

function isSaveNeeded (id, iface, ifaceDesc, propName) {
  if (savedStateCache[id] === undefined) {
    debug(`No saved state cached for id ${id}, will save.`)
    return true
  }

  const cached = savedStateCache[id]

  if (cached[propName] !== iface[propName]) {
    debug(`Property ${propName} for id ${id} has changed, need to save.`)
    return true
  }

  debug(`Property ${propName} for id ${id} has not changed, no need to save.`)
  return false
}

function isNullChange (id, iface, propName) {
  if (!propName) {
    return false
  }

  const cached = savedStateCache[id]
  if (cached === undefined) {
    return false
  }

  const oldValue = cached[propName]
  const newValue = iface[propName]
  if ((oldValue === null && newValue !== null) ||
    (oldValue !== null && newValue === null)) {
    debug(`Property ${propName} for id ${id} has changed from/to null, need to save.`)
    return true
  }

  return false
}

async function savePersistedState (RED, id, iface, ifaceDesc, propName) {
  const fname = `${getFsLocation(RED)}/${id}.json`

  if (propName && !isSaveNeeded(id, iface, ifaceDesc, propName)) {
    return
  }

  if (!isNullChange(id, iface, propName) && setupToWriteLater(RED, id, iface, ifaceDesc, propName)) {
    debug(`Not writing now, will write later, id=${id}, property ${propName}`)
    return
  }

  const state = {}

  for (const key in ifaceDesc.properties) {
    if (iface[key] !== undefined && ifaceDesc.properties[key].persist) {
      debug('save property to persisted state', key, iface[key])
      state[key] = iface[key]
    }
  }

  try {
    fs.writeFileSync(fname + '.tmp', JSON.stringify({ state }, null, 2), 'utf8')
    fs.renameSync(fname + '.tmp', fname)
    debug(`Persisted state for ${id} saved to ${fname}`)
    lastSaveAt[id] = Date.now() // Update last save time
    savedStateCache[id] = state
  } catch (error) {
    console.error(`Error saving persisted state for ${id}:`, error)
  }
}

module.exports = {
  hasPersistedState,
  needsPersistedState,
  loadPersistedState,
  savePersistedState
}
