# E2E Testing for Node-RED Victron Contrib

End-to-end testing setup using **Playwright** + **Jest** + **Node-RED Admin API**.

## Quick Start

```bash
# Install dependencies
npm install

# Run e2e tests (headless)
npm run test:e2e

# Run with browser visible (for debugging)
npm run test:e2e:headed

# Run with screenshots
SCREENSHOTS=true npm run test:e2e

# Debug with browser dev tools
DEVTOOLS=true HEADED=true npm run test:e2e
```

## Device Configuration

Configure which Victron device to test against:

```bash
# Test against Venus device over TCP (default)
E2E_DEVICE=tcp DBUS_TCP_ADDRESS=tcp:host=venus.local,port=78 npm run test:e2e

# Test against local GX device
E2E_DEVICE=local npm run test:e2e

# Test with mock dbus (CI/testing)
E2E_DEVICE=mock npm run test:e2e
```

## Test Structure

```
test/e2e/
├── config.js              # Device endpoints and test configuration
├── global-setup.js        # Start Node-RED instance
├── global-teardown.js     # Stop Node-RED instance  
├── helper.js              # Main test utilities (Admin API + Playwright)
├── setup.js               # Per-test setup/teardown
├── test-settings.js       # Node-RED configuration for tests
└── **/*.test.js           # Actual test files
```

## Writing Tests

### Basic Test Structure

```javascript
describe('My User Story', () => {
  test('user can do something', async () => {
    // Use global helper instance
    await helper.openEditor()
    
    // Create nodes via editor interaction
    const node = await helper.dragNodeToWorkspace('victron-virtual')
    await helper.openNodeConfig(node)
    await helper.setNodeProperty('name', 'Test Node')
    await helper.saveNodeConfig()
    
    // Deploy and verify
    await helper.deployFlow()
    await helper.assertFlowDeployed()
    
    // Take screenshot for debugging
    await helper.screenshot('test-completed')
  })
})
```

### Using Admin API

```javascript
test('programmatic flow deployment', async () => {
  // Deploy flow via API (faster than UI interaction)
  const flow = helper.createVirtualBatteryFlow()
  await helper.deployFlow(flow)
  
  // Open editor to verify
  await helper.openEditor()
  
  // Verify services are available
  const services = await helper.waitForVictronServices()
  expect(services.length).toBeGreaterThan(0)
})
```

### Device Configuration Testing

```javascript
test('works with different device endpoints', async () => {
  // Current device config is automatically used
  const deviceConfig = config.getCurrentDevice()
  console.log('Testing with device:', deviceConfig)
  
  // Test will use appropriate dbus connection
  await helper.openEditor()
  // ... rest of test
})
```

## Available Helpers

### Browser Automation
- `helper.setupBrowser()` - Initialize Playwright browser
- `helper.openEditor()` - Navigate to Node-RED editor
- `helper.screenshot(name)` - Take screenshot for debugging
- `helper.dragNodeToWorkspace(nodeType, x, y)` - Add node via drag-drop

### Node Configuration  
- `helper.openNodeConfig(nodeElement)` - Double-click to open config
- `helper.setNodeProperty(field, value)` - Set input field value
- `helper.selectDropdownOption(field, option)` - Select from dropdown
- `helper.saveNodeConfig()` - Save and close config dialog

### Flow Management
- `helper.deployFlow(flowConfig)` - Deploy via Admin API
- `helper.clearFlows()` - Remove all flows
- `helper.createTestFlow(nodes)` - Generate flow configuration
- `helper.createVirtualBatteryFlow()` - Pre-built test flow

### Victron-Specific
- `helper.waitForVictronServices()` - Wait for services endpoint
- `helper.createVictronVirtualNode(deviceType)` - Create virtual device
- `helper.createVictronInputNode(service, path)` - Create input node

### Assertions
- `helper.assertFlowDeployed()` - Verify deployment success
- `helper.assertNodeStatus(node, status)` - Check node status
- `await expect(element).toBeVisible()` - Playwright assertions

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `E2E_DEVICE` | Device type: `tcp`, `local`, `mock` | `tcp` |
| `E2E_PORT` | Node-RED test port | `1881` |
| `DBUS_TCP_ADDRESS` | Dbus TCP connection | `tcp:host=venus.local,port=78` |
| `HEADED` | Run browser visibly | `false` |
| `SCREENSHOTS` | Save screenshots | `false` |
| `DEVTOOLS` | Open browser devtools | `false` |
| `DEBUG_NODERED` | Show Node-RED logs | `false` |
| `DEBUG_BROWSER` | Show browser console | `false` |

## Example User Stories

See `virtual-battery.test.js` for complete examples:

- ✅ User creates virtual battery through editor
- ✅ Virtual battery provides realistic data values  
- ✅ User can modify virtual battery parameters
- ✅ Virtual battery persists across restarts
- ✅ Virtual battery appears in Victron device list

## Debugging

### Visual Debugging
```bash
# Run with visible browser and screenshots
HEADED=true SCREENSHOTS=true npm run test:e2e
```

### Slow Motion
```bash
# Slow down actions for observation
SLOW_MO=100 HEADED=true npm run test:e2e
```

### Node-RED Logs
```bash
# See Node-RED startup and runtime logs
DEBUG_NODERED=true npm run test:e2e
```

### Browser Console
```bash  
# See browser console messages
DEBUG_BROWSER=true HEADED=true npm run test:e2e
```

## CI Integration

The tests can run headless in CI environments:

```yaml
# .github/workflows/e2e.yml
- name: Run E2E Tests
  run: |
    E2E_DEVICE=mock npm run test:e2e
```
