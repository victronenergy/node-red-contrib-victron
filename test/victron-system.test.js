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

describe('getNodeServices null value handling', () => {
  let systemConfig
  let originalServices

  beforeEach(() => {
    originalServices = utils.SERVICES
    systemConfig = new SystemConfiguration()
  })

  afterEach(() => {
    utils.SERVICES = originalServices
  })

  test('includes paths with null D-Bus values in input node dropdown, labeled with - (null)', () => {
    utils.SERVICES = {
      multi: {
        multi: [
          { path: '/Ac/In/1/CurrentLimit', type: 'float', name: 'AC Input 1 Current Limit', mode: 'both' },
          { path: '/Ac/In/2/CurrentLimit', type: 'float', name: 'AC Input 2 Current Limit', mode: 'both' },
          { path: '/Ac/Out/P', type: 'float', name: 'AC Output Power', mode: 'input' }
        ]
      }
    }

    systemConfig.cache = {
      'com.victronenergy.multi.socketcan_vecan0_vi2_uc738825': {
        '/Ac/In/1/CurrentLimit': 16,
        '/Ac/In/2/CurrentLimit': null,
        '/Ac/Out/P': 500,
        '/DeviceInstance': 0
      }
    }

    const result = systemConfig.getNodeServices('input-multi')
    const paths = result.services[0].paths

    expect(paths.find(p => p.path === '/Ac/In/1/CurrentLimit')).toBeDefined()
    const nullPath = paths.find(p => p.path === '/Ac/In/2/CurrentLimit')
    expect(nullPath).toBeDefined()
    expect(nullPath.name).toBe('AC Input 2 Current Limit - (null)')
    expect(paths.find(p => p.path === '/Ac/Out/P')).toBeDefined()
  })

  test('includes paths with null D-Bus values in output node dropdown, labeled with - (null)', () => {
    utils.SERVICES = {
      multi: {
        multi: [
          { path: '/Ac/In/1/CurrentLimit', type: 'float', name: 'AC Input 1 Current Limit', mode: 'both' },
          { path: '/Ac/In/2/CurrentLimit', type: 'float', name: 'AC Input 2 Current Limit', mode: 'both' }
        ]
      }
    }

    systemConfig.cache = {
      'com.victronenergy.multi.socketcan_vecan0_vi2_uc738825': {
        '/Ac/In/1/CurrentLimit': 16,
        '/Ac/In/2/CurrentLimit': null,
        '/Ac/In/1/CurrentLimitIsAdjustable': 1,
        '/Ac/In/2/CurrentLimitIsAdjustable': 1,
        '/DeviceInstance': 0
      }
    }

    const result = systemConfig.getNodeServices('output-multi')
    const paths = result.services[0].paths

    expect(paths.find(p => p.path === '/Ac/In/1/CurrentLimit')).toBeDefined()
    const nullPath = paths.find(p => p.path === '/Ac/In/2/CurrentLimit')
    expect(nullPath).toBeDefined()
    expect(nullPath.name).toBe('AC Input 2 Current Limit - (null)')
  })
})

describe('getCachedServices null value handling (custom nodes)', () => {
  let systemConfig

  beforeEach(() => {
    systemConfig = new SystemConfiguration()
    systemConfig.cache = {
      'com.victronenergy.multi.socketcan_vecan0_vi2_uc738825': {
        '/Ac/In/1/CurrentLimit': 16,
        '/Ac/In/2/CurrentLimit': null,
        '/Ac/Out/P': 500,
        '/DeviceInstance': 0
      }
    }
  })

  test('custom nodes still show paths with null D-Bus values', () => {
    const result = systemConfig.getCachedServices()
    const service = result.services[0]
    const paths = service.paths

    expect(paths.find(p => p.path === '/Ac/In/1/CurrentLimit')).toBeDefined()
    expect(paths.find(p => p.path === '/Ac/In/2/CurrentLimit')).toBeDefined()
    expect(paths.find(p => p.path === '/Ac/Out/P')).toBeDefined()
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
