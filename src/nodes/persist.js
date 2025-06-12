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

async function savePersistedState (id, iface, ifaceDesc) {
  const fname = `${FS_LOCATION}/${id}.json`

  const state = {}

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
