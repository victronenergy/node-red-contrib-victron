// test/e2e/helper.js
const { chromium } = require('playwright')
const axios = require('axios')
const config = require('./config')

class NodeRedE2EHelper {
  constructor() {
    this.browser = null
    this.page = null
    this.adminUrl = global.__NODE_RED_URL__
    this.editorUrl = `${this.adminUrl}/`
  }

  // Browser management
  async setupBrowser() {
    this.browser = await chromium.launch(config.browser)
    const context = await this.browser.newContext({
      // Set viewport for consistent testing
      viewport: { width: 1280, height: 1024 }
    })
    
    this.page = await context.newPage()
    
    // Useful for debugging
    if (process.env.DEBUG_BROWSER) {
      this.page.on('console', msg => console.log('Browser:', msg.text()))
      this.page.on('pageerror', error => console.error('Browser Error:', error))
    }
    
    return this.page
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close()
    }
  }

  // Node-RED Admin API methods
  async deployFlow(flowConfig) {
    const response = await axios.post(`${this.adminUrl}/flows`, flowConfig, {
      headers: { 'Content-Type': 'application/json' }
    })
    return response.data
  }

  async getFlows() {
    const response = await axios.get(`${this.adminUrl}/flows`)
    return response.data
  }

  async clearFlows() {
    await axios.post(`${this.adminUrl}/flows`, [], {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  async getNodeRedInfo() {
    const response = await axios.get(`${this.adminUrl}/settings`)
    return response.data
  }

  // Test flow templates
  createTestFlow(nodes, connections = []) {
    return {
      flows: [
        ...nodes.map(node => ({
          ...config.flows[node.type] || node,
          x: node.x || 100,
          y: node.y || 100,
          wires: node.wires || [[]]
        })),
        ...connections
      ]
    }
  }

  createVictronClientFlow() {
    return {
      flows: [{
        ...config.flows.victronClient,
        x: 100,
        y: 100
      }]
    }
  }

  createVirtualBatteryFlow() {
    return this.createTestFlow([
      { type: 'victronClient' },
      { 
        type: 'victronVirtual',
        x: 200,
        y: 100,
        wires: [['debug-node']]
      },
      {
        id: 'debug-node',
        type: 'debug',
        name: 'Debug Output',
        x: 400,
        y: 100
      }
    ])
  }

  // Node-RED Editor interactions
  async openEditor() {
    await this.page.goto(this.editorUrl)
    await this.page.waitForSelector('#red-ui-workspace')
    
    // Wait for editor to fully load
    await this.page.waitForFunction(() => {
      return window.RED && window.RED.editor
    })
  }

  async dragNodeToWorkspace(nodeType, x = 200, y = 200) {
    // Find node in palette
    const paletteNode = await this.page.locator(`[data-palette-type="${nodeType}"]`).first()
    
    // Drag to workspace
    const workspace = await this.page.locator('#red-ui-workspace-chart')
    await paletteNode.dragTo(workspace, { 
      targetPosition: { x, y }
    })
    
    // Return the created node element
    await this.page.waitForTimeout(500) // Allow node to be created
    return this.page.locator('.red-ui-flow-node').last()
  }

  async openNodeConfig(nodeElement) {
    await nodeElement.dblclick()
    await this.page.waitForSelector('.red-ui-editor')
  }

  async setNodeProperty(fieldId, value) {
    const field = this.page.locator(`#node-input-${fieldId}`)
    await field.fill(value)
  }

  async selectDropdownOption(fieldId, optionText) {
    const dropdown = this.page.locator(`#node-input-${fieldId}`)
    await dropdown.selectOption({ label: optionText })
  }

  async saveNodeConfig() {
    await this.page.locator('#red-ui-editor-config-scope-ok').click()
    await this.page.waitForSelector('.red-ui-editor', { state: 'hidden' })
  }

  async deployFlow() {
    await this.page.locator('#red-ui-header-button-deploy').click()
    
    // Wait for deployment to complete
    await this.page.waitForFunction(() => {
      const deployButton = document.querySelector('#red-ui-header-button-deploy')
      return !deployButton.classList.contains('red-ui-deploy-button-armed')
    })
  }

  // Victron-specific helpers
  async waitForVictronServices() {
    // Wait for victron services endpoint to be available
    let retries = 0
    const maxRetries = 10
    
    while (retries < maxRetries) {
      try {
        const response = await axios.get(`${this.adminUrl}/victron/services`)
        if (response.status === 200) {
          return response.data
        }
      } catch (error) {
        // Service not ready yet
      }
      
      retries++
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Victron services not available within timeout')
  }

  async createVictronInputNode(service, path) {
    const node = await this.dragNodeToWorkspace('victron-input-battery')
    await this.openNodeConfig(node)
    
    // Configure the node
    await this.setNodeProperty('name', `Test ${service}`)
    await this.selectDropdownOption('service', service)
    await this.selectDropdownOption('path', path)
    
    await this.saveNodeConfig()
    return node
  }

  async createVictronVirtualNode(deviceType = 'battery') {
    const node = await this.dragNodeToWorkspace('victron-virtual')
    await this.openNodeConfig(node)
    
    await this.setNodeProperty('name', `Test Virtual ${deviceType}`)
    await this.selectDropdownOption('device', deviceType)
    
    await this.saveNodeConfig()
    return node
  }

  // Assertions and validations
  async assertNodeStatus(nodeElement, expectedStatus) {
    const statusText = await nodeElement.locator('.red-ui-flow-node-status-label').textContent()
    expect(statusText).toBe(expectedStatus)
  }

  async assertFlowDeployed() {
    // Check that deploy button is not armed (indicating successful deployment)
    const deployButton = await this.page.locator('#red-ui-header-button-deploy')
    const isArmed = await deployButton.evaluate(el => 
      el.classList.contains('red-ui-deploy-button-armed')
    )
    expect(isArmed).toBe(false)
  }

  // Debug helpers
  async screenshot(name) {
    if (process.env.SCREENSHOTS) {
      await this.page.screenshot({ 
        path: `test/e2e/screenshots/${name}.png`,
        fullPage: true
      })
    }
  }

  async getDebugMessages() {
    // Access debug sidebar messages
    return await this.page.evaluate(() => {
      const debugMessages = []
      document.querySelectorAll('.red-ui-debug-msg').forEach(msg => {
        debugMessages.push(msg.textContent)
      })
      return debugMessages
    })
  }
}

module.exports = NodeRedE2EHelper
