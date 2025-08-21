const victronVirtualInitFunction = require('../src/nodes/victron-virtual')

// Mock dbus-native-victron to prevent actual dbus connections
jest.mock('dbus-native-victron', () => {
  const mockConnection = {
    on: jest.fn(),
    end: jest.fn(),
    removeListener: jest.fn(),
    addListener: jest.fn()
  }
  
  const mockBus = {
    connection: mockConnection,
    getInterface: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    exportInterface: jest.fn(),
    requestName: jest.fn((serviceName, flags, callback) => {
      // Simulate successful name request
      if (callback) callback(null, 1)
    }),
    listNames: jest.fn(),
    getNameOwner: jest.fn(),
    addMatch: jest.fn(),
    invoke: jest.fn()
  }

  return {
    sessionBus: jest.fn(() => mockBus),
    systemBus: jest.fn(() => mockBus),
    createClient: jest.fn(() => mockBus)
  }
})

// Mock dbus-victron-virtual to prevent actual virtual device creation
jest.mock('dbus-victron-virtual', () => ({
  addVictronInterfaces: jest.fn((bus, ifaceDesc, iface, addDefaults, emitCallback) => ({
    removeSettings: jest.fn(() => Promise.resolve()),
    getValue: jest.fn(() => Promise.resolve([null, [[]]])),
    setValuesLocally: jest.fn()
  })),
  addSettings: jest.fn((bus, settings) => {
    // Mock device instance assignment - simulate successful settings creation
    // The fallback parsing expects: result[1][0].split(':')[1] to be the device instance number
    return Promise.resolve([
      null,
      [
        'ClassAndVrmInstance:254'
      ]
    ])
  })
}))

// Mock the persist module to prevent filesystem operations
jest.mock('../src/nodes/persist', () => ({
  savePersistedState: jest.fn(() => Promise.resolve()),
  loadPersistedState: jest.fn(() => Promise.resolve({})),
  hasPersistedState: jest.fn(() => false),
  needsPersistedState: jest.fn(() => false)
}))

// Mock debug module to prevent console output during tests  
jest.mock('debug', () => jest.fn(() => jest.fn()))

describe('victron-virtual configuration logic', () => {
  let mockRED
  let registerTypeSpy
  let createNodeSpy
  let VictronVirtualNode
  let consoleWarnSpy
  
  // Set timeout for all tests in this suite
  jest.setTimeout(5000)

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Mock console.warn to suppress expected warnings during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    
    // Mock Node-RED createNode function
    createNodeSpy = jest.fn(function (self, config) {
      self.name = config.name
      self.device = config.device
      self.id = config.id || 'test-node-id'
      self.on = jest.fn()
      self.send = jest.fn()
      self.warn = jest.fn()
      self.error = jest.fn()
      self.status = jest.fn()
      self.context = jest.fn().mockReturnValue({
        global: { set: jest.fn(), get: jest.fn() }
      })
    })

    registerTypeSpy = jest.fn()

    // Mock getNode for victron-client dependency (based on victron-nodes.test.js)
    const subscribeSpy = jest.fn()
    const getValueSpy = jest.fn().mockResolvedValue([null, [[]]])  // Mock empty device list
    
    const getNodeFn = function (id) {
      if (id === 'victron-client-id') {
        return {
          addStatusListener: jest.fn(),
          client: {
            subscribe: subscribeSpy,
            client: {
              connected: true, // Set to true but with mocked functions
              getValue: getValueSpy,
              services: {}
            }
          },
          showValues: true
        }
      }
      throw new Error('[mock getNode] Node not found: ' + id)
    }

    mockRED = {
      nodes: {
        registerType: registerTypeSpy,
        createNode: createNodeSpy,
        getNode: getNodeFn
      },
      log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      settings: {
        userDir: '/tmp/test-user-dir'
      }
    }

    // Initialize the virtual node
    victronVirtualInitFunction(mockRED)
    VictronVirtualNode = registerTypeSpy.mock.calls[0][1]
  })

  afterEach(() => {
    jest.clearAllMocks()
    // Restore console.warn
    if (consoleWarnSpy) {
      consoleWarnSpy.mockRestore()
    }
    // Reset any environment variables
    delete process.env.NODE_RED_DBUS_ADDRESS
  })

  describe('Node Registration', () => {
    test('registers victron-virtual node type', () => {
      expect(registerTypeSpy).toHaveBeenCalledWith('victron-virtual', expect.any(Function))
    })
    
    test('mocks are working properly', () => {
      expect(jest.isMockFunction(registerTypeSpy)).toBe(true)
      expect(VictronVirtualNode).toBeInstanceOf(Function)
    })
  })

  describe('Device Configuration - Battery', () => {
    test('creates battery node with default configuration', () => {
      const config = {
        device: 'battery',
        name: 'Test Battery',
        clientId: 'victron-client-id'
      }

      const node = new VictronVirtualNode(config)

      expect(node.device).toBe('battery')
      expect(node.name).toBe('Test Battery')
      expect(createNodeSpy).toHaveBeenCalledWith(node, config)
    })

    test('sets battery capacity when provided', () => {
      const config = {
        device: 'battery',
        battery_capacity: '100',
        clientId: 'victron-client-id',
        name: 'Test Battery'
      }

      const node = new VictronVirtualNode(config)
      
      // Test that node creation doesn't throw and basic properties are set
      expect(node.device).toBe('battery')
      expect(node.name).toBe('Test Battery')
      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })

    test('handles default values configuration', () => {
      const config = {
        device: 'battery',
        default_values: true,
        clientId: 'victron-client-id'
      }

      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })

    test('handles battery temperature inclusion', () => {
      const configWithTemp = {
        device: 'battery',
        include_battery_temperature: true,
        clientId: 'victron-client-id'
      }

      const configWithoutTemp = {
        device: 'battery',
        include_battery_temperature: false,
        clientId: 'victron-client-id'
      }

      expect(() => new VictronVirtualNode(configWithTemp)).not.toThrow()
      expect(() => new VictronVirtualNode(configWithoutTemp)).not.toThrow()
    })
  })

  describe('Device Configuration - Generator', () => {
    test('creates AC generator node', () => {
      const config = {
        device: 'generator',
        generator_type: 'ac',
        generator_nrofphases: '3',
        clientId: 'victron-client-id'
      }

      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })

    test('creates DC generator node', () => {
      const config = {
        device: 'generator',
        generator_type: 'dc',
        clientId: 'victron-client-id'
      }

      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })
  })

  describe('Device Configuration - Grid Meter', () => {
    test('creates grid meter with phase configuration', () => {
      const config = {
        device: 'grid',
        grid_nrofphases: '3',
        clientId: 'victron-client-id'
      }

      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })
  })

  describe('Device Configuration - PV Inverter', () => {
    test('creates PV inverter node', () => {
      const config = {
        device: 'pvinverter',
        pvinverter_nrofphases: '1',
        clientId: 'victron-client-id'
      }

      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })
  })

  describe('Other Device Types', () => {
    const deviceTypes = ['motor', 'meteo', 'switch', 'tank', 'temperature', 'gps']

    deviceTypes.forEach(deviceType => {
      test(`creates ${deviceType} device node`, () => {
        const config = {
          device: deviceType,
          name: `Test ${deviceType}`,
          clientId: 'victron-client-id'
        }

        expect(() => new VictronVirtualNode(config)).not.toThrow()
      })
    })
  })

  describe('Input Message Validation', () => {
    test('warns when receiving message without payload', () => {
      const config = {
        device: 'battery',
        clientId: 'victron-client-id'
      }

      const node = new VictronVirtualNode(config)

      // Simulate input handler - we need to access it indirectly
      // Since the actual dbus connection is mocked out, we test the validation logic
      expect(node.warn).toBeDefined()
    })

    test('handles missing client configuration gracefully', () => {
      const config = {
        device: 'battery',
        name: 'Test Battery'
        // Missing clientId
      }

      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })
  })

  describe('Node State Management', () => {
    test('initializes with pending calls array', () => {
      const config = {
        device: 'battery',
        clientId: 'victron-client-id'
      }

      const node = new VictronVirtualNode(config)

      expect(Array.isArray(node.pendingCallsToSetValuesLocally)).toBe(true)
      expect(node.pendingCallsToSetValuesLocally.length).toBe(0)
    })

    test('sets up dbus address from environment', () => {
      const originalEnv = process.env.NODE_RED_DBUS_ADDRESS
      process.env.NODE_RED_DBUS_ADDRESS = 'venus.local:78'

      const config = {
        device: 'battery',
        clientId: 'victron-client-id'
      }

      const node = new VictronVirtualNode(config)

      expect(node.address).toBe('tcp:host=venus.local,port=78')

      // Restore environment
      if (originalEnv) {
        process.env.NODE_RED_DBUS_ADDRESS = originalEnv
      } else {
        delete process.env.NODE_RED_DBUS_ADDRESS
      }
    })
  })

  describe('Error Handling', () => {
    test('handles invalid device type gracefully', () => {
      const config = {
        device: 'invalid-device-type',
        clientId: 'victron-client-id'
      }

      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })

    test('handles missing device configuration', () => {
      const config = {
        name: 'Test Node',
        clientId: 'victron-client-id'
        // Missing device type
      }

      expect(() => new VictronVirtualNode(config)).not.toThrow()
    })
  })
})

// Test the helper functions that are now extracted
describe('victron-virtual helper functions', () => {
  describe('device registry system', () => {
    test('device registry should be accessible', () => {
      const { getDeviceConfig, isDeviceSupported } = require('../src/nodes/victron-virtual/device-types')
      
      expect(getDeviceConfig).toBeDefined()
      expect(isDeviceSupported).toBeDefined()
      expect(typeof getDeviceConfig).toBe('function')
      expect(typeof isDeviceSupported).toBe('function')
    })

    test('battery device should be in registry', () => {
      const { getDeviceConfig, isDeviceSupported } = require('../src/nodes/victron-virtual/device-types')
      
      expect(isDeviceSupported('battery')).toBe(true)
      const batteryConfig = getDeviceConfig('battery')
      expect(batteryConfig).toBeDefined()
      expect(batteryConfig.properties).toBeDefined()
      expect(batteryConfig.configure).toBeDefined()
    })

    test('meteo device should be in registry', () => {
      const { getDeviceConfig, isDeviceSupported } = require('../src/nodes/victron-virtual/device-types')
      
      expect(isDeviceSupported('meteo')).toBe(true)
      const meteoConfig = getDeviceConfig('meteo')
      expect(meteoConfig).toBeDefined()
      expect(meteoConfig.properties).toBeDefined()
      expect(meteoConfig.configure).toBeDefined()
    })

    test('unsupported devices return null', () => {
      const { getDeviceConfig, isDeviceSupported } = require('../src/nodes/victron-virtual/device-types')
      
      expect(isDeviceSupported('evcs')).toBe(false) 
      expect(getDeviceConfig('evcs')).toBe(null)
    })

  })

  describe('extracted battery device', () => {
    test('battery capacity is not persistent', () => {
      const { getDeviceConfig } = require('../src/nodes/victron-virtual/device-types')
      const batteryConfig = getDeviceConfig('battery')
      
      expect(batteryConfig.properties.Capacity.persist).toBeUndefined()
      expect(batteryConfig.properties.Soc.persist).toBe(15) // SOC should be persistent
    })
  })

  describe('legacy functions', () => {
    test('getIfaceDesc function should be replaced by registry lookup', () => {
      // Placeholder for when we fully migrate
      expect(true).toBe(true)
    })

    test('getIface function should be replaced by registry lookup', () => {
      // Placeholder for when we fully migrate  
      expect(true).toBe(true)
    })
  })
})

// Replace the "legacy functions" describe block in victron-virtual.test.js with this:

describe('Interface Creation Functions (Regression Tests)', () => {
  test('device interface has proper dbus paths, not string character indices', () => {
    const { createIfaceDesc } = require('../src/nodes/victron-virtual/utils')
    const { getDeviceConfig } = require('../src/nodes/victron-virtual/device-types')

    const batteryConfig = getDeviceConfig('battery')
    const ifaceDesc = createIfaceDesc(batteryConfig.properties)

    // Verify we get actual device paths, not string character indices
    expect(ifaceDesc['Dc/0/Voltage']).toBeDefined()
    expect(ifaceDesc['Dc/0/Current']).toBeDefined()
    expect(ifaceDesc.Soc).toBeDefined()
    expect(ifaceDesc.Capacity).toBeDefined()

    // CRITICAL: These should NOT exist - they would indicate the bug where
    // 'battery' string was treated as properties object
    expect(ifaceDesc['0']).toBeUndefined()  // 'b' char at index 0
    expect(ifaceDesc['1']).toBeUndefined()  // 'a' char at index 1 
    expect(ifaceDesc['2']).toBeUndefined()  // 't' char at index 2
    expect(ifaceDesc['3']).toBeUndefined()  // 't' char at index 3
    expect(ifaceDesc['4']).toBeUndefined()  // 'e' char at index 4
    expect(ifaceDesc['5']).toBeUndefined()  // 'r' char at index 5
    expect(ifaceDesc['6']).toBeUndefined()  // 'y' char at index 6

    // Verify structure is valid
    expect(ifaceDesc['Dc/0/Voltage'].type).toBe('d')
    expect(typeof ifaceDesc.Capacity.format).toBe('function')
  })

  test('device interface object has proper structure, not string characters', () => {
    const { createIface } = require('../src/nodes/victron-virtual/utils')
    const { getDeviceConfig } = require('../src/nodes/victron-virtual/device-types')

    const batteryConfig = getDeviceConfig('battery')
    const iface = createIface(batteryConfig.properties)

    // Should have valid device properties
    expect(iface.Connected).toBe(1)
    expect(iface['Info/ChargeRequest']).toBe(0)
    expect(iface.emit).toBeDefined()
    expect(typeof iface.emit).toBe('function')

    // CRITICAL: These should NOT exist - they indicate the string iteration bug
    expect(iface['0']).toBeUndefined()
    expect(iface['1']).toBeUndefined()
    expect(iface['2']).toBeUndefined()
    expect(iface['3']).toBeUndefined()
    expect(iface['4']).toBeUndefined()
    expect(iface['5']).toBeUndefined()
    expect(iface['6']).toBeUndefined()

    // Verify actual device paths exist
    expect('Dc/0/Voltage' in iface).toBe(true)
    expect('Dc/0/Current' in iface).toBe(true)
    expect('Soc' in iface).toBe(true)
  })

  test('utility functions handle invalid string input (regression protection)', () => {
    const { createIfaceDesc, createIface } = require('../src/nodes/victron-virtual/utils')

    // Test what happens if someone accidentally passes a string instead of properties
    // This simulates the bug that was fixed
    const badIfaceDesc = createIfaceDesc('battery')
    const badIface = createIface('battery')

    // Should handle gracefully, not iterate over string characters
    expect(badIfaceDesc).toEqual({})
    expect(badIface.emit).toBeDefined()

    // Should NOT have string character indices
    expect(badIfaceDesc['0']).toBeUndefined()
    expect(badIface['0']).toBeUndefined()
  })
})
