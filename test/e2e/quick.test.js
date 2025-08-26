// test/e2e/quick-test-working.js
const { spawn } = require('child_process')
const axios = require('axios')
const path = require('path')

async function testNodeRedStart() {
  console.log('Starting Node-RED for quick test...')
  
  const testPort = 1882
  const settingsPath = path.join(__dirname, 'test-settings.js')
  
  const nodeRedProcess = spawn('npx', [
    'node-red',
    '--settings', settingsPath,
    '--port', testPort.toString()
  ], {
    stdio: 'pipe',
    env: {
      ...process.env,
      NO_UPDATE_NOTIFIER: '1',
      NODE_RED_DBUS_ADDRESS: 'mock://test'
    }
  })

  let processKilled = false

  nodeRedProcess.stdout.on('data', (data) => {
    if (!processKilled) {
      console.log(`Node-RED: ${data.toString().trim()}`)
    }
  })

  nodeRedProcess.stderr.on('data', (data) => {
    if (!processKilled) {
      console.error(`Node-RED Error: ${data.toString().trim()}`)
    }
  })

  // Wait for Node-RED to start
  let retries = 0
  const maxRetries = 20
  const adminUrl = `http://localhost:${testPort}`
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(`${adminUrl}/settings`, { timeout: 5000 })
      console.log('✅ Node-RED started successfully!')
      
      // Test if victron nodes are loaded
      try {
        const nodes = await axios.get(`${adminUrl}/nodes`, { timeout: 5000 })
        const victronNodes = nodes.data.filter(node => 
          node.module === '@victronenergy/node-red-contrib-victron'
        )
        
        console.log(`✅ Found ${victronNodes.length} Victron nodes loaded`)
        victronNodes.forEach(node => {
          console.log(`   - ${node.name} (${node.types.join(', ')})`)
        })
      } catch (nodeError) {
        console.warn('Could not fetch node list, but Node-RED is running')
      }
      
      // Success! Clean shutdown and exit
      console.log('Stopping Node-RED...')
      processKilled = true
      nodeRedProcess.kill('SIGTERM')
      
      // Wait for process to exit
      await new Promise((resolve) => {
        nodeRedProcess.on('exit', resolve)
        setTimeout(() => {
          nodeRedProcess.kill('SIGKILL')
          resolve()
        }, 3000)
      })
      
      console.log('✅ Quick test completed successfully!')
      return // SUCCESS EXIT
      
    } catch (error) {
      if (i >= maxRetries - 1) {
        console.error('❌ Node-RED failed to start within timeout')
        processKilled = true
        nodeRedProcess.kill('SIGTERM')
        process.exit(1)
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

// Only run if called directly (not when required)
if (require.main === module) {
  testNodeRedStart().catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })
}

module.exports = testNodeRedStart
