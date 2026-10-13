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

// Orion XS emergency (reverse) charging, see venus-private#662. Exposed on the
// .alternator service (charging the main battery) and on the .dcdc service
// (charging an aux battery), but not in PSU mode.
describe.each(['alternator', 'dcdc'])('Orion XS emergency charging on %s', (serviceName) => {
  let systemConfig

  beforeEach(() => {
    systemConfig = new SystemConfiguration()
    systemConfig.cache = {
      [`com.victronenergy.${serviceName}.ttyUSB0`]: {
        '/ProductName': 'Orion XS',
        '/DeviceInstance': 0,
        '/EmergencyCharge/Control': 2,
        '/EmergencyCharge/ChargingCountdown': 0,
        '/EmergencyCharge/BlockedCountdown': 0
      }
    }
  })

  test('/EmergencyCharge/Control is a writable enum with the documented states', () => {
    const control = servicesJson[serviceName][serviceName].find(p => p.path === '/EmergencyCharge/Control')
    expect(control).toBeDefined()
    expect(control.type).toBe('enum')
    expect(control.mode).toBe('both')
    expect(Object.keys(control.enum).sort()).toEqual(['0', '2', '3'])
  })

  test('/State includes the reverse charging states', () => {
    const state = servicesJson[serviceName][serviceName].find(p => p.path === '/State')
    expect(state.enum['242']).toBe('Reverse charging blocked')
    expect(state.enum['243']).toBe('Reverse charging')
  })

  test(`output-${serviceName} offers only /EmergencyCharge/Control for writing`, () => {
    const result = systemConfig.getNodeServices(`output-${serviceName}`)
    const paths = result.services[0].paths.map(p => p.path)
    expect(paths).toContain('/EmergencyCharge/Control')
    expect(paths).not.toContain('/EmergencyCharge/ChargingCountdown')
    expect(paths).not.toContain('/EmergencyCharge/BlockedCountdown')
  })

  test(`input-${serviceName} offers all emergency charge paths for reading`, () => {
    const result = systemConfig.getNodeServices(`input-${serviceName}`)
    const paths = result.services[0].paths.map(p => p.path)
    expect(paths).toEqual(expect.arrayContaining([
      '/EmergencyCharge/Control',
      '/EmergencyCharge/ChargingCountdown',
      '/EmergencyCharge/BlockedCountdown'
    ]))
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

describe('generator input node - device instance display', () => {
  let systemConfig

  beforeEach(() => {
    systemConfig = new SystemConfiguration()
  })

  test('device instance 0 is returned as string "0", not empty string', () => {
    systemConfig.cache = {
      'com.victronenergy.generator/0': {
        '/ProductName': 'Generator Start/Stop',
        '/DeviceInstance': 0,
        '/State': 0
      }
    }
    const result = systemConfig.getNodeServices('input-generator')
    expect(result.services).toHaveLength(1)
    expect(result.services[0].deviceInstance).toBe('0')
  })

  test('two generator controllers produce two distinct dropdown entries with device instances', () => {
    systemConfig.cache = {
      'com.victronenergy.generator/0': {
        '/ProductName': 'Generator Start/Stop',
        '/DeviceInstance': 0,
        '/State': 0
      },
      'com.victronenergy.generator/1': {
        '/ProductName': 'Generator Start/Stop',
        '/DeviceInstance': 1,
        '/State': 0
      }
    }
    const result = systemConfig.getNodeServices('input-generator')
    expect(result.services).toHaveLength(2)
    const instances = result.services.map(s => s.deviceInstance).sort()
    expect(instances).toEqual(['0', '1'])
  })

  test('stale no-trail entry alongside trail entry returns two services (cache dedup is in saveToCache)', () => {
    // This documents the expected behavior when the cache has BOTH a stale no-trail
    // entry and a correct trail entry. The fix (in saveToCache) prevents this state
    // from occurring. If it does occur, getNodeServices shows both.
    systemConfig.cache = {
      'com.victronenergy.generator': {
        '/ProductName': 'Generator Start/Stop',
        '/State': 0
      },
      'com.victronenergy.generator/0': {
        '/ProductName': 'Generator Start/Stop',
        '/DeviceInstance': 0,
        '/State': 0
      }
    }
    const result = systemConfig.getNodeServices('input-generator')
    // Both entries are found - this confirms what the bug looks like
    expect(result.services).toHaveLength(2)
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

describe('ESS battery status reason codes (issue #342)', () => {
  const ESS_REASON_PATHS = [
    '/SystemState/LowSoc',
    '/SystemState/BatteryLife',
    '/SystemState/ChargeDisabled',
    '/SystemState/DischargeDisabled',
    '/SystemState/SlowCharge',
    '/SystemState/UserChargeLimited',
    '/SystemState/UserDischargeLimited'
  ]

  test.each(ESS_REASON_PATHS)('%s is in services.json system section as an enum', (path) => {
    const item = servicesJson.system.system.find(p => p.path === path)
    expect(item).toBeDefined()
    expect(item.type).toBe('enum')
    expect(item.enum).toHaveProperty('0')
    expect(item.enum).toHaveProperty('1')
  })

  test('input-system node exposes all ESS reason code paths when present in cache', () => {
    const systemConfig = new SystemConfiguration()
    const cacheValues = Object.fromEntries(ESS_REASON_PATHS.map(p => [p, 0]))
    systemConfig.cache = {
      'com.victronenergy.system/0': {
        '/DeviceInstance': 0,
        ...cacheValues
      }
    }
    const result = systemConfig.getNodeServices('input-system')
    const exposedPaths = result.services[0].paths.map(p => p.path)
    for (const essPath of ESS_REASON_PATHS) {
      expect(exposedPaths).toContain(essPath)
    }
  })
})

describe('heatpump SwitchableOutput support (Shelly relays used to control a heat pump)', () => {
  let systemConfig

  beforeEach(() => {
    systemConfig = new SystemConfiguration()
    systemConfig.cache = {
      'com.victronenergy.heatpump.shelly_D885AC1B38F4_0': {
        '/DeviceInstance': 40,
        '/CustomName': 'Kelder - heating',
        '/SwitchableOutput/0/State': 1,
        '/SwitchableOutput/0/Status': 1,
        '/SwitchableOutput/0/Settings/CustomName': 'Kelder - heating'
      }
    }
  })

  test('output-switch node whitelist includes a heatpump entry', () => {
    expect(servicesJson.switch.heatpump).toBeDefined()
    expect(servicesJson.switch.heatpump.find(p => p.path === '/SwitchableOutput/{type}/State')).toBeDefined()
  })

  test('output-switch node exposes the heatpump service SwitchableOutput/State path', () => {
    const result = systemConfig.getNodeServices('output-switch')
    const heatpumpService = result.services.find(s => s.service.startsWith('com.victronenergy.heatpump'))
    expect(heatpumpService).toBeDefined()
    const statePath = heatpumpService.paths.find(p => p.path === '/SwitchableOutput/0/State')
    expect(statePath).toBeDefined()
  })

  test('SwitchableOutput display name uses the CustomName, matching switch behaviour', () => {
    const result = systemConfig.getNodeServices('output-switch')
    const heatpumpService = result.services.find(s => s.service.startsWith('com.victronenergy.heatpump'))
    const statePath = heatpumpService.paths.find(p => p.path === '/SwitchableOutput/0/State')
    expect(statePath.name).toBe('Kelder - heating state')
  })
})

// Aurelia DCDB (Koro GX), as found on com.victronenergy.switch.ttyS2: dimmable outputs
// 01-06, toggle outputs 07-09, fuse-monitored outputs 10-23 (Status only) and
// push button generic inputs 01-09.
describe('Aurelia DCDB on the switch nodes', () => {
  let systemConfig

  beforeEach(() => {
    systemConfig = new SystemConfiguration()
    systemConfig.cache = {
      'com.victronenergy.switch/275': {
        '/ProductName': 'Aurelia DCDB',
        '/DeviceInstance': 275,
        '/State': 256,
        '/ModuleVoltage': 13.2,
        '/SwitchableOutput/01/Name': 'output 01',
        '/SwitchableOutput/01/Settings/CustomName': '',
        '/SwitchableOutput/01/State': 0,
        '/SwitchableOutput/01/Dimming': 52.4,
        '/SwitchableOutput/01/Status': 0,
        '/SwitchableOutput/10/Name': 'output 10',
        '/SwitchableOutput/10/Settings/CustomName': '',
        '/SwitchableOutput/10/Status': 9,
        '/GenericInput/01/Name': 'input 01',
        '/GenericInput/01/Settings/CustomName': '',
        '/GenericInput/01/Settings/Labels': '["/released","/pressed","/holding"]',
        '/GenericInput/01/Value': 0,
        '/GenericInput/01/Event': 2,
        '/GenericInput/01/Status': 0
      }
    }
  })

  const pathsOf = (nodeName) => {
    const result = systemConfig.getNodeServices(nodeName)
    expect(result.services).toHaveLength(1)
    return result.services[0].paths
  }

  test('input-switch offers the module state and voltage', () => {
    const paths = pathsOf('input-switch')
    expect(paths.find(p => p.path === '/State')).toMatchObject({ type: 'enum', name: 'Module state' })
    expect(paths.find(p => p.path === '/State').enum['256']).toBe('Connected')
    expect(paths.find(p => p.path === '/ModuleVoltage')).toMatchObject({ type: 'float', name: 'Module voltage (V)' })
  })

  test('input-switch offers the status of every output, including fuse-monitored ones', () => {
    const paths = pathsOf('input-switch')
    expect(paths.find(p => p.path === '/SwitchableOutput/01/Status')).toMatchObject({ type: 'enum', name: 'output 01 status' })
    const fuseStatus = paths.find(p => p.path === '/SwitchableOutput/10/Status')
    expect(fuseStatus.name).toBe('output 10 status')
    expect(fuseStatus.enum['9']).toBe('On')
  })

  test('input-switch offers the generic input value, event and status', () => {
    const names = Object.fromEntries(pathsOf('input-switch').map(p => [p.path, p.name]))
    expect(names['/GenericInput/01/Value']).toBe('input 01 value')
    expect(names['/GenericInput/01/Event']).toBe('input 01 event')
    expect(names['/GenericInput/01/Status']).toBe('input 01 status')
  })

  test('input-switch offers per-output measurements only when the device publishes them', () => {
    expect(pathsOf('input-switch').map(p => p.path)).not.toContain('/SwitchableOutput/01/Current')

    Object.assign(systemConfig.cache['com.victronenergy.switch/275'], {
      '/SwitchableOutput/01/Current': 1.5,
      '/SwitchableOutput/01/Voltage': 13.1,
      '/SwitchableOutput/01/Temperature': 31,
      '/SwitchableOutput/01/Measurement': 21.5
    })
    const names = Object.fromEntries(pathsOf('input-switch').map(p => [p.path, p.name]))
    expect(names['/SwitchableOutput/01/Current']).toBe('output 01 current (A)')
    expect(names['/SwitchableOutput/01/Voltage']).toBe('output 01 voltage (V)')
    expect(names['/SwitchableOutput/01/Temperature']).toBe('output 01 temperature (°C)')
    expect(names['/SwitchableOutput/01/Measurement']).toBe('output 01 measurement')
  })

  test('output-switch offers no read-only paths', () => {
    const paths = pathsOf('output-switch').map(p => p.path)
    expect(paths).toEqual(expect.arrayContaining(['/SwitchableOutput/01/State', '/SwitchableOutput/01/Dimming']))
    expect(paths.filter(p => /\/(Status|Value|Event)$|^\/State$|^\/ModuleVoltage$/.test(p))).toEqual([])
  })
})
