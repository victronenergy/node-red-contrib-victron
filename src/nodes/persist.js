import fs from 'fs'

const FS_LOCATION = process.env.PERSISTED_STATE_LOCATION || '/data/home/nodered/.victron'

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

function hasPersistedState (id) {
  // ensure the directory exists
  if (!fs.existsSync(FS_LOCATION)) {
    fs.mkdirSync(FS_LOCATION, { recursive: true })
  }

  const fname = `${FS_LOCATION}/${id}.json`
  return fs.existsSync(fname)
}

async function loadPersistedState (id, iface, ifaceDesc) {
  const fname = `${FS_LOCATION}/${id}.json`

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
function setupToWriteLater (id, iface, ifaceDesc, propName) {
  if (!propName) {
    return false // No debounce if no property name is provided, we always write immediately
  }

  const propDesc = ifaceDesc.properties[propName]
  if (propDesc && typeof propDesc.persist === 'number') {
    // If throttle is set, we debounce the save

    const now = Date.now()
    const millis = propDesc.persist * 1_000

    if (!lastSaveAt[id] || (now - lastSaveAt[id]) >= millis) {
      console.log(`Writing immediately, last save was more than ${millis} ms ago, lastSavedAt=${lastSaveAt[id]}, now=${now}, id=${id}, property ${propName}`)
      return false // write now, we wrote more than millis ago
    }

    if (timers[id] && timers[id].at < lastSaveAt[id] + millis) {
      // we leave the timer in place.
      console.log(`Writing now, last save was at ${lastSaveAt[id]}, millis=${millis}, id=${id}, property ${propName}`)
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
          console.log(`Writing persisted state for ${id} after a delay of ${at - now} millis, property ${propName}`)
          savePersistedState(id, iface, ifaceDesc)
        }, at - now),
        at
      }
      return true
    }
  } else {
    console.log(`No delayed persist set for property ${propName}, id=${id}`)
    return false // Not writing later, we write immediately
  }
}

async function savePersistedState (id, iface, ifaceDesc, propName) {
  const fname = `${FS_LOCATION}/${id}.json`

  const state = {}

  if (setupToWriteLater(id, iface, ifaceDesc, propName)) {
    console.log(`Not writing now, will write later, id=${id}, property ${propName}`)
    return
  }

  for (const key in ifaceDesc.properties) {
    if (iface[key] !== undefined && ifaceDesc.properties[key].persist) {
      console.log('save property to persisted state', key, iface[key])
      state[key] = iface[key]
    }
  }

  try {
    fs.writeFileSync(fname + '.tmp', JSON.stringify({ state }, null, 2), 'utf8')
    fs.renameSync(fname + '.tmp', fname)
    console.log(`Persisted state for ${id} saved to ${fname}`)
    lastSaveAt[id] = Date.now() // Update last save time
  } catch (error) {
    console.error(`Error saving persisted state for ${id}:`, error)
  }
}

export {
  hasPersistedState,
  needsPersistedState,
  loadPersistedState,
  savePersistedState
}
