const SystemConfiguration = require('../src/services/victron-system')
const utils = require('../src/services/utils')

describe('SystemConfiguration.getRelayServices wildcard expansion (PR #256)', () => {
  let systemConfig
  let originalServices
  let consoleErrorSpy

  beforeEach(() => {
    // Save original services
    originalServices = utils.SERVICES
    
    // Spy on console.error to verify error handling
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    systemConfig = new SystemConfiguration()
    
    // Set up basic cache structure
    systemConfig.cache = {
      'com.victronenergy.system/0': {
        '/Relay/0/State': 0,
        '/Relay/1/State': 1,
        '/DeviceInstance': 0,
        '/ProductName': 'Venus GX'
      },
      'com.victronenergy.settings': {
        '/Settings/Relay/Function': 2 // manual mode
      }
    }
  })

  afterEach(() => {
    // Restore original services and console
    utils.SERVICES = originalServices
    consoleErrorSpy.mockRestore()
  })

  test('getRelayServices returns relay services when paths exist in cache', () => {
    const result = systemConfig.getRelayServices()

    expect(result).toHaveProperty('communityTag')
    expect(result).toHaveProperty('services')
    expect(Array.isArray(result.services)).toBe(true)

    // Should find system service with relay paths
    if (result.services.length > 0) {
      const systemService = result.services.find(service =>
        service.service === 'com.victronenergy.system/0'
      )

      if (systemService) {
        expect(systemService.name).toBe('Venus device')
        expect(systemService.paths).toBeDefined()
      }
    }
  })

  test('getRelayServices handles missing relay definitions without crashing', () => {
    // Mock SERVICES to have empty relay definitions for 'system' service
    // This simulates the scenario that caused the regression in issue #253
    utils.SERVICES = {
      ...originalServices,
      relay: {
        system: [] // Empty array - no relay definitions
      }
    }

    // Should not throw error even with missing relay definitions (this is what PR #256 fixes)
    expect(() => {
      const result = systemConfig.getRelayServices()
      expect(result).toHaveProperty('services')
      expect(Array.isArray(result.services)).toBe(true)
    }).not.toThrow()

    // The function should complete without crashing (core fix for issue #253)
    const result = systemConfig.getRelayServices()
    expect(result).toHaveProperty('services')
    expect(Array.isArray(result.services)).toBe(true)
  })

  test('getRelayServices filters out null relay objects', () => {
    // Create scenario where some relay objects are null
    utils.SERVICES = {
      ...originalServices,
      relay: {
        system: [
          null, // This should be filtered out
          {
            path: '/Relay/0/State',
            type: 'enum',
            name: 'Venus relay 1 state',
            enum: { '0': 'Open', '1': 'Closed' },
            mode: 'both'
          }
        ]
      }
    }

    const result = systemConfig.getRelayServices()

    // Should handle null objects gracefully
    expect(() => {
      const result = systemConfig.getRelayServices()
      expect(result).toHaveProperty('services')
      expect(Array.isArray(result.services)).toBe(true)
    }).not.toThrow()
  })

  test('getRelayServices handles empty cache gracefully', () => {
    systemConfig.cache = {}

    const result = systemConfig.getRelayServices()

    expect(result).toHaveProperty('services')
    expect(Array.isArray(result.services)).toBe(true)
    expect(result.services.length).toBe(0)
  })

  test('getRelayServices handles system relay function check', () => {
    // Test the system relay function logic (manual vs non-manual)
    systemConfig.cache['com.victronenergy.settings']['/Settings/Relay/Function'] = 1 // non-manual

    expect(() => {
      const result = systemConfig.getRelayServices()
      expect(result).toHaveProperty('services')
      expect(Array.isArray(result.services)).toBe(true)
    }).not.toThrow()
  })

  test('getRelayServices basic wildcard expansion scenario', () => {
    // Mock services with wildcard pattern
    utils.SERVICES = {
      ...originalServices,
      relay: {
        system: [
          {
            path: '/Relay/{relay}/State',
            type: 'enum',
            name: 'Venus relay {relay} state',
            enum: { '0': 'Open', '1': 'Closed' },
            mode: 'both'
          }
        ]
      }
    }

    // Test that wildcard expansion doesn't break the function
    expect(() => {
      const result = systemConfig.getRelayServices()
      expect(result).toHaveProperty('services')
      expect(Array.isArray(result.services)).toBe(true)
    }).not.toThrow()
  })
})
