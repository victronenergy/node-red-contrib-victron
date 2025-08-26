// test/e2e/setup.js
const NodeRedE2EHelper = require('./helper')
const fs = require('fs')
const path = require('path')

// Extend Jest expect with Playwright assertions
expect.extend({
  async toBeVisible(received) {
    const pass = await received.isVisible()
    return {
      message: () => `expected element to be visible`,
      pass
    }
  }
})

// Global test helper instance
let helper = null

// Create screenshots directory if it doesn't exist
const screenshotDir = path.join(__dirname, 'screenshots')
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

// Make helper available globally
beforeEach(async () => {
  helper = new NodeRedE2EHelper()
  await helper.setupBrowser()
  global.helper = helper
})

afterEach(async () => {
  if (helper) {
    // Clear flows after each test for isolation
    try {
      await helper.clearFlows()
    } catch (error) {
      console.warn('Failed to clear flows:', error.message)
    }
    
    await helper.closeBrowser()
  }
})
