// test/e2e/global-setup.js
const { spawn } = require('child_process')
const axios = require('axios')
const path = require('path')
const config = require('./config')

let nodeRedProcess = null

async function startNodeRed() {
  // Try multiple ways to find Node-RED
  let nodeRedPath
  try {
    // First try the standard approach
    nodeRedPath = require.resolve('node-red/red.js')
  } catch (error) {
    try {
      // Fallback: try finding node-red in node_modules
      nodeRedPath = require.resolve('node-red/lib/red.js')
    } catch (error2) {
      // Final fallback: use npx which should work if Node-RED is installed
      console.log('Using npx fallback for Node-RED')
      return startNodeRedWithNpx()
    }
  }
  
  const settingsPath = path.join(__dirname, 'test-settings.js')
  
  console.log('Starting Node-RED for e2e tests...')
  
  nodeRedProcess = spawn('node', [
    nodeRedPath,
    '--settings', settingsPath,
    '--port', config.nodeRed.port.toString(),
    '--userDir', path.join(__dirname, '.node-red-test')
  ], {
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_RED_DBUS_ADDRESS: config.getCurrentDevice().dbusAddress
    }
  })

  nodeRedProcess.stdout.on('data', (data) => {
    if (process.env.DEBUG_NODERED) {
      console.log(`Node-RED: ${data}`)
    }
  })

  nodeRedProcess.stderr.on('data', (data) => {
    if (process.env.DEBUG_NODERED) {
      console.error(`Node-RED Error: ${data}`)
    }
  })

  // Wait for Node-RED to be ready
  const adminUrl = `http://${config.nodeRed.host}:${config.nodeRed.port}`
  let retries = 0
  const maxRetries = 30
  
  while (retries < maxRetries) {
    try {
      await axios.get(`${adminUrl}/settings`)
      console.log('Node-RED is ready!')
      break
    } catch (error) {
      retries++
      if (retries >= maxRetries) {
        throw new Error('Node-RED failed to start within timeout')
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Store process reference globally for cleanup
  global.__NODE_RED_PROCESS__ = nodeRedProcess
  global.__NODE_RED_URL__ = adminUrl
}

// Fallback function using npx (like your VSCode launch config)
async function startNodeRedWithNpx() {
  const settingsPath = path.join(__dirname, 'test-settings.js')
  
  console.log('Starting Node-RED with npx...')
  
  nodeRedProcess = spawn('npx', [
    'node-red',
    '--settings', settingsPath,
    '--port', config.nodeRed.port.toString(),
    '--userDir', path.join(__dirname, '.node-red-test')
  ], {
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_RED_DBUS_ADDRESS: config.getCurrentDevice().dbusAddress,
      NO_UPDATE_NOTIFIER: '1'
    }
  })

  nodeRedProcess.stdout.on('data', (data) => {
    if (process.env.DEBUG_NODERED) {
      console.log(`Node-RED: ${data}`)
    }
  })

  nodeRedProcess.stderr.on('data', (data) => {
    if (process.env.DEBUG_NODERED) {
      console.error(`Node-RED Error: ${data}`)
    }
  })

  // Wait for Node-RED to be ready
  const adminUrl = `http://${config.nodeRed.host}:${config.nodeRed.port}`
  let retries = 0
  const maxRetries = 30
  
  while (retries < maxRetries) {
    try {
      await axios.get(`${adminUrl}/settings`)
      console.log('Node-RED is ready!')
      break
    } catch (error) {
      retries++
      if (retries >= maxRetries) {
        throw new Error('Node-RED failed to start within timeout')
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Store process reference globally for cleanup
  global.__NODE_RED_PROCESS__ = nodeRedProcess
  global.__NODE_RED_URL__ = adminUrl
}

module.exports = startNodeRed
