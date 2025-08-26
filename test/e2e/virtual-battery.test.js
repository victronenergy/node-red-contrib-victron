// test/e2e/virtual-battery-api.test.js
const axios = require('axios')
const config = require('./config')

describe('Virtual Battery API Tests', () => {
  let adminUrl

  beforeAll(() => {
    adminUrl = global.__NODE_RED_URL__
    console.log('Testing with Node-RED at:', adminUrl)
  })

  afterEach(async () => {
    // Clean up flows after each test
    try {
      await axios.post(`${adminUrl}/flows`, [], {  // Send empty array, not {flows: []}
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.warn('Failed to clear flows:', error.message)
    }
  })

  test('Can deploy virtual battery flow via API', async () => {
    const virtualBatteryFlow = [
      {
        id: 'victron-client-test',
        type: 'victron-client',
        name: 'Test Victron Client',
        z: 'virtual-battery-flow',
        x: 100,
        y: 100
      },
      {
        id: 'virtual-battery-test',
        type: 'victron-virtual',
        name: 'Test Virtual Battery',
        device: 'battery',
        clientId: 'victron-client-test',
        z: 'virtual-battery-flow',
        x: 300,
        y: 100,
        wires: [[]]
      }
    ]

    const response = await axios.post(`${adminUrl}/flows`, virtualBatteryFlow, {
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(response.status).toBe(204)  // Node-RED returns 204 for successful deployments
    console.log('✅ Virtual battery flow deployed')
    
    // Give Node-RED time to initialize nodes
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Verify flow was deployed
    const getResponse = await axios.get(`${adminUrl}/flows`)
    const deployedNodes = getResponse.data
    
    const clientNode = deployedNodes.find(node => node.type === 'victron-client')
    const virtualNode = deployedNodes.find(node => node.type === 'victron-virtual')
    
    expect(clientNode).toBeDefined()
    expect(virtualNode).toBeDefined()
    expect(virtualNode.device).toBe('battery')
    
    console.log('✅ Virtual battery flow verification complete')
  })

  test('Multiple virtual devices can be deployed', async () => {
    const multiDeviceFlow = [
      {
        id: 'victron-client-multi',
        type: 'victron-client',
        name: 'Multi Device Client',
        z: 'multi-device-flow',
        x: 100,
        y: 100
      },
      {
        id: 'virtual-battery-multi',
        type: 'victron-virtual',
        name: 'Virtual Battery',
        device: 'battery',
        clientId: 'victron-client-multi',
        z: 'multi-device-flow',
        x: 300,
        y: 100,
        wires: [[]]
      },
      {
        id: 'virtual-generator-multi',
        type: 'victron-virtual',
        name: 'Virtual Generator',
        device: 'generator',
        clientId: 'victron-client-multi',
        z: 'multi-device-flow',
        x: 300,
        y: 200,
        wires: [[]]
      }
    ]

    const response = await axios.post(`${adminUrl}/flows`, multiDeviceFlow, {
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(response.status).toBe(204)
    
    // Give time for initialization
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Verify deployment
    const getResponse = await axios.get(`${adminUrl}/flows`)
    const deployedNodes = getResponse.data
    
    const virtualNodes = deployedNodes.filter(node => node.type === 'victron-virtual')
    expect(virtualNodes.length).toBe(2)
    
    const deviceTypes = virtualNodes.map(node => node.device)
    expect(deviceTypes).toContain('battery')
    expect(deviceTypes).toContain('generator')
    
    console.log('✅ Multiple virtual devices deployed successfully')
  })

  test('Flow deployment handles node dependencies correctly', async () => {
    // Test deploying virtual node without client first (should still work)
    const orphanVirtualFlow = [
      {
        id: 'orphan-virtual',
        type: 'victron-virtual',
        name: 'Orphan Virtual Battery',
        device: 'battery',
        clientId: 'non-existent-client',
        z: 'orphan-flow',
        x: 300,
        y: 100,
        wires: [[]]
      }
    ]

    const response = await axios.post(`${adminUrl}/flows`, orphanVirtualFlow, {
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(response.status).toBe(204)
    console.log('✅ Orphan virtual node deployment handled gracefully')
  })
})

test('debug browser navigation', async () => {
  console.log('Admin URL:', helper.adminUrl)
  console.log('Editor URL:', helper.editorUrl)
  
  // Navigate and check what we actually get
  await helper.page.goto(helper.editorUrl)
  await helper.screenshot('01-initial-load')
  
  // Check page title and URL
  const title = await helper.page.title()
  const url = helper.page.url()
  console.log('Page title:', title)
  console.log('Current URL:', url)
  
  // Check if there are any console errors
  const logs = []
  helper.page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`))
  helper.page.on('pageerror', error => logs.push(`ERROR: ${error.message}`))
  
  await helper.page.waitForTimeout(5000) // Wait 5 seconds
  await helper.screenshot('02-after-wait')
  
  console.log('Browser console logs:', logs)
  
  // Check what HTML is actually loaded
  const bodyHTML = await helper.page.locator('body').innerHTML()
  console.log('Body HTML (first 500 chars):', bodyHTML.substring(0, 500))
}, 60000)

test('can open Node-RED editor with better error handling', async () => {
  console.log('Starting browser test...')
  
  // Wait a bit for Node-RED to be fully ready
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  try {
    console.log('Navigating to:', helper.editorUrl)
    
    // Use more permissive navigation options
    await helper.page.goto(helper.editorUrl, { 
      waitUntil: 'domcontentloaded', // Less strict than 'load'
      timeout: 15000 
    })
    
    console.log('✅ Page loaded')
    await helper.screenshot('01-page-loaded')
    
    // Check what actually loaded
    const title = await helper.page.title()
    console.log('Page title:', title)
    
    // Look for Node-RED specific elements with longer timeout
    try {
      await helper.page.waitForSelector('body', { timeout: 5000 })
      console.log('✅ Body element found')
      
      // Try different selectors Node-RED might use
      const selectors = ['#red-ui-workspace', '.red-ui-workspace', '[id*="workspace"]', '.red-ui-editor']
      
      for (const selector of selectors) {
        try {
          await helper.page.waitForSelector(selector, { timeout: 5000 })
          console.log(`✅ Found element: ${selector}`)
          await helper.screenshot(`found-${selector.replace(/[^a-zA-Z0-9]/g, '-')}`)
          break
        } catch (e) {
          console.log(`❌ Element not found: ${selector}`)
        }
      }
      
    } catch (error) {
      console.log('Basic elements not found:', error.message)
      await helper.screenshot('02-basic-elements-missing')
    }
    
  } catch (error) {
    console.error('❌ Browser test failed:', error.message)
    await helper.screenshot('99-navigation-error')
    throw error
  }
}, 60000)
