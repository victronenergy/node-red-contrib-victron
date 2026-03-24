const SystemConfiguration = require('../src/services/victron-system')
const utils = require('../src/services/utils')
const servicesJson = require('../src/services/services.json')

describe('Alternator /Mode control (Orion XS in Charger mode)', () => {
  let systemConfig

  beforeEach(() => {
    systemConfig = new SystemConfiguration()
    systemConfig.cache = {
      'com.victronenergy.alternator.ttyUSB0': {
        '/ProductName': 'Orion XS',
        '/Mode': 1,
        '/ModeIsAdjustable': 1,
        '/State': 3,
        '/DeviceInstance': 0
      }
    }
  })

  test('alternator /Mode has mode: both in services.json', () => {
    const modePath = servicesJson.alternator.alternator.find(p => p.path === '/Mode')
    expect(modePath).toBeDefined()
    expect(modePath.mode).toBe('both')
  })

  test('output-alternator node exposes /Mode for writing', () => {
    const result = systemConfig.getNodeServices('output-alternator')
    expect(result.services).toHaveLength(1)
    const modePath = result.services[0].paths.find(p => p.path === '/Mode')
    expect(modePath).toBeDefined()
  })

  test('input-alternator node exposes /Mode for reading', () => {
    const result = systemConfig.getNodeServices('input-alternator')
    expect(result.services).toHaveLength(1)
    const modePath = result.services[0].paths.find(p => p.path === '/Mode')
    expect(modePath).toBeDefined()
  })

  test('output-alternator is included in listAvailableServices', () => {
    const services = systemConfig.listAvailableServices()
    expect(services).toHaveProperty('output-alternator')
  })
})

describe('SystemConfiguration path sorting', () => {
  let systemConfig
  let originalServices

  beforeEach(() => {
    originalServices = utils.SERVICES
    systemConfig = new SystemConfiguration()
  })

  afterEach(() => {
    utils.SERVICES = originalServices
  })

  test('sorts paths case-insensitively by name field', () => {
    // Set up test services with mixed case names
    utils.SERVICES = {
      battery: {
        battery: [
          { path: '/Dc/0/Voltage', type: 'float', name: 'battery voltage', mode: 'input' },
          { path: '/Current', type: 'float', name: 'Current', mode: 'input' },
          { path: '/Soc', type: 'float', name: 'State of charge', mode: 'input' },
          { path: '/Alarms/LowVoltage', type: 'integer', name: 'alarm: Low voltage', mode: 'input' },
          { path: '/ConsumedAmphours', type: 'float', name: 'Consumed Amphours', mode: 'input' }
        ]
      }
    }

    // Set up cache with a battery service
    systemConfig.cache = {
      'com.victronenergy.battery.ttyUSB0': {
        '/Dc/0/Voltage': 12.5,
        '/Current': 10.2,
        '/Soc': 80,
        '/Alarms/LowVoltage': 0,
        '/ConsumedAmphours': 15.3,
        '/DeviceInstance': 1
      }
    }

    const result = systemConfig.getNodeServices('input-battery')

    // Extract the paths from the result
    const paths = result.services[0].paths

    // Verify we got all paths
    expect(paths).toHaveLength(5)

    // Verify case-insensitive alphabetical sorting by name
    // Expected order: "alarm: Low voltage", "battery voltage", "Consumed Amphours", "Current", "State of charge"
    expect(paths[0].name).toBe('alarm: Low voltage')
    expect(paths[1].name).toBe('battery voltage')
    expect(paths[2].name).toBe('Consumed Amphours')
    expect(paths[3].name).toBe('Current')
    expect(paths[4].name).toBe('State of charge')
  })

  test('sorts paths with special characters correctly', () => {
    utils.SERVICES = {
      test: {
        test: [
          { path: '/Path1', type: 'float', name: 'Voltage (V)', mode: 'input' },
          { path: '/Path2', type: 'float', name: 'voltage', mode: 'input' },
          { path: '/Path3', type: 'float', name: 'Temperature', mode: 'input' },
          { path: '/Path4', type: 'float', name: 'Watt (W)', mode: 'input' }
        ]
      }
    }

    systemConfig.cache = {
      'com.victronenergy.test/0': {
        '/Path1': 1,
        '/Path2': 2,
        '/Path3': 3,
        '/Path4': 4,
        '/DeviceInstance': 0
      }
    }

    const result = systemConfig.getNodeServices('input-test')
    const paths = result.services[0].paths

    // Verify alphabetical ordering (case-insensitive)
    expect(paths[0].name).toBe('Temperature')
    expect(paths[1].name).toBe('voltage')
    expect(paths[2].name).toBe('Voltage (V)')
    expect(paths[3].name).toBe('Watt (W)')
  })
})
