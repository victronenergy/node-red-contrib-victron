// test/e2e/basic-setup.test.js
const axios = require('axios')
const config = require('./config')

describe('Basic E2E Setup', () => {
  let adminUrl

  beforeAll(() => {
    adminUrl = global.__NODE_RED_URL__
    console.log('Testing with Node-RED at:', adminUrl)
  })

  test('Node-RED admin API is accessible', async () => {
    const response = await axios.get(`${adminUrl}/settings`)
    expect(response.status).toBe(200)  // GET requests return 200
    expect(response.data).toHaveProperty('version')
    console.log('✅ Node-RED version:', response.data.version)
  })

  test('Node-RED flows API is accessible', async () => {
    const response = await axios.get(`${adminUrl}/flows`)
    expect(response.status).toBe(200)
    expect(Array.isArray(response.data.flows || response.data)).toBe(true)
    console.log('✅ Flows API working')
  })

  test('Victron services endpoint is accessible', async () => {
    try {
      const response = await axios.get(`${adminUrl}/victron/services`)
      expect(response.status).toBe(200)
      console.log('✅ Victron services endpoint working')
    } catch (error) {
      if (error.response?.status === 503) {
        console.log('⚠️ Victron client not initialized (expected in mock mode)')
        expect(error.response.status).toBe(503)
      } else {
        throw error
      }
    }
  })

  test('Can deploy a simple flow via API', async () => {
    // Node-RED flows API expects just an array of nodes, not wrapped in {flows: []}
    const simpleFlow = [
      {
        id: 'test-inject',
        type: 'inject',
        name: 'Test Inject',
        z: 'test-flow', // flow id that groups nodes together
        topic: '',
        payload: 'Hello E2E',
        payloadType: 'str',
        repeat: '',
        crontab: '',
        once: false,
        x: 100,
        y: 100,
        wires: [['test-debug']]
      },
      {
        id: 'test-debug',
        type: 'debug',
        name: 'Test Debug',
        z: 'test-flow', // same flow id
        active: true,
        console: false,
        complete: 'payload',
        x: 300,
        y: 100,
        wires: []
      }
    ]

    const response = await axios.post(`${adminUrl}/flows`, simpleFlow, {
      headers: { 'Content-Type': 'application/json' }
    })
    
    expect(response.status).toBe(204)
    console.log('✅ Simple flow deployed successfully')
    
    // Verify flow was deployed
    const getResponse = await axios.get(`${adminUrl}/flows`)
    const deployedNodes = getResponse.data.filter(node => 
      node.id === 'test-inject' || node.id === 'test-debug'
    )
    expect(deployedNodes.length).toBe(2)
    console.log('✅ Flow deployment verified')
  })
})
