// test/victron-virtual-evcs.test.js
/* eslint-env jest */
const evcs = require('../src/nodes/victron-virtual/device-type/evcs')

function makeFixtures () {
  return {
    ifaceDesc: { properties: {} },
    iface: {},
    node: { error: jest.fn() }
  }
}

describe('evcs (EV charger) device module', () => {
  test('exports required contract', () => {
    expect(typeof evcs.properties).toBe('function')
    expect(typeof evcs.initialize).toBe('function')
    expect(typeof evcs.getServiceType).toBe('function')
    expect(typeof evcs.productType).toBe('function')
    expect(evcs.supportsS2).toBe(true)
  })

  test('getServiceType always returns evcharger', () => {
    expect(evcs.getServiceType()).toBe('evcharger')
    expect(evcs.getServiceType({})).toBe('evcharger')
  })

  // Not 'grid': that made the Remote Console list it as "Virtual grid meter" (#581).
  test('productType always returns evcs', () => {
    expect(evcs.productType()).toBe('evcs')
    expect(evcs.productType({})).toBe('evcs')
    expect(evcs.productType({ evcs_charging_control: true })).toBe('evcs')
  })

  test('properties include Position with AC output/AC input formatting', () => {
    const properties = evcs.properties({})
    expect(properties.Position).toBeDefined()
    expect(properties.Position.format(0)).toBe('AC output')
    expect(properties.Position.format(1)).toBe('AC input')
  })

  // Position is a node setting, not persisted, so the GX must not offer to change it.
  test('properties report PositionIsAdjustable as 0', () => {
    expect(evcs.properties({}).PositionIsAdjustable.value).toBe(0)
  })

  test('properties include the minimal generic meter fields', () => {
    const properties = evcs.properties({})
    expect(properties['Ac/Power']).toBeDefined()
    expect(properties.IsGenericEnergyMeter.value).toBe(1)
  })

  test('initialize adds phase properties and returns a label', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    const result = evcs.initialize({ evcs_nrofphases: 3 }, ifaceDesc, iface, node)
    expect(ifaceDesc.properties['Ac/L1/Power']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L2/Power']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L3/Power']).toBeDefined()
    expect(iface.PhaseSetting).toBeUndefined()
    expect(result).toBe('Virtual 3-phase EV charger')
  })

  test('initialize sets Position from config', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    evcs.initialize({ evcs_position: '1' }, ifaceDesc, iface, node)
    expect(iface.Position).toBe(1)
  })

  // Nodes deployed before Position existed have no evcs_position; 0 (AC output) keeps their behavior.
  test('initialize defaults Position to 0 (AC output) when not set', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    evcs.initialize({}, ifaceDesc, iface, node)
    expect(iface.Position).toBe(0)
  })

  test('initialize uses the configured phase for a 1-phase config', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    evcs.initialize({ evcs_nrofphases: 1, evcs_phasesetting: '2' }, ifaceDesc, iface, node)
    expect(iface.PhaseSetting).toBe(2)
    expect(ifaceDesc.properties.PhaseSetting).toBeDefined()
    expect(ifaceDesc.properties['Ac/L2/Power']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L1/Power']).toBeUndefined()
  })

  test('initialize defaults to 1 phase', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    evcs.initialize({}, ifaceDesc, iface, node)
    expect(iface.NrOfPhases).toBe(1)
    expect(iface.PhaseSetting).toBe(1)
    expect(ifaceDesc.properties['Ac/L1/Power']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L2/Power']).toBeUndefined()
  })
})

describe('evcs charging control mode', () => {
  const EVSE_PATHS = [
    'Mode', 'StartStop', 'AutoStart', 'EnableDisplay',
    'Current', 'SetCurrent', 'MinCurrent', 'MaxCurrent',
    'Status', 'ChargingTime',
    'Session/Time', 'Session/Energy', 'Session/Cost', 'Session/SavedCost',
    'Session/UserId', 'Session/UserIdType',
    'Model'
  ]
  const PERSISTED_SETTINGS = ['Mode', 'StartStop', 'AutoStart', 'EnableDisplay', 'SetCurrent', 'MinCurrent', 'MaxCurrent']

  test('measurement-only mode has no EVSE paths', () => {
    const properties = evcs.properties({})
    EVSE_PATHS.forEach(path => expect(properties[path]).toBeUndefined())
  })

  test('charging control mode exposes all EVSE paths and no alarms', () => {
    const properties = evcs.properties({ evcs_charging_control: true })
    EVSE_PATHS.forEach(path => expect(properties[path]).toBeDefined())
    expect(Object.keys(properties).some(k => k.startsWith('Alarms/'))).toBe(false)
  })

  test('charging control mode reports IsGenericEnergyMeter 0', () => {
    expect(evcs.properties({ evcs_charging_control: true }).IsGenericEnergyMeter.value).toBe(0)
  })

  test('charging control mode keeps Position', () => {
    expect(evcs.properties({ evcs_charging_control: true }).Position).toBeDefined()
  })

  test.each(PERSISTED_SETTINGS)('%s is persisted', (path) => {
    expect(evcs.properties({ evcs_charging_control: true })[path].persist).toBeTruthy()
  })

  test('Model is a string property', () => {
    expect(evcs.properties({ evcs_charging_control: true }).Model.type).toBe('s')
  })

  describe('value texts', () => {
    const properties = evcs.properties({ evcs_charging_control: true })

    test.each([
      ['Mode', 0, 'Manual'],
      ['Mode', 1, 'Auto'],
      ['Mode', 2, 'Scheduled'],
      ['StartStop', 0, 'Stop'],
      ['StartStop', 1, 'Start'],
      ['AutoStart', 0, 'Disabled'],
      ['AutoStart', 1, 'Enabled'],
      ['EnableDisplay', 0, 'Control disabled'],
      ['EnableDisplay', 1, 'Control enabled'],
      ['Status', 0, 'Disconnected'],
      ['Status', 2, 'Charging'],
      ['Status', 14, 'Overheating detected'],
      ['Status', 20, 'Charging limit'],
      ['Status', 21, 'Starting to charge'],
      ['Status', 24, 'Stopping charging'],
      ['Session/UserIdType', 0, 'Unknown'],
      ['Session/UserIdType', 1, 'BLE']
    ])('%s %s -> %s', (path, value, expected) => {
      expect(properties[path].format(value)).toBe(expected)
    })

    test('unknown enum value is shown as unknown', () => {
      expect(properties.Status.format(17)).toBe('unknown')
    })

    test.each([
      ['SetCurrent', 16, '16.0A'],
      ['Session/Energy', 7.2, '7.20kWh'],
      ['Session/Time', 3600, '3600s']
    ])('%s %s -> %s', (path, value, expected) => {
      expect(properties[path].format(value)).toBe(expected)
    })
  })

  describe('initialize with default values', () => {
    test('sets EVSE defaults in charging control mode', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      evcs.initialize({ evcs_charging_control: true, default_values: true }, ifaceDesc, iface, node)
      expect(iface).toMatchObject({
        Mode: 0,
        StartStop: 0,
        AutoStart: 1,
        EnableDisplay: 1,
        Status: 0,
        Current: 0,
        SetCurrent: 6,
        MinCurrent: 6,
        MaxCurrent: 32,
        ChargingTime: 0,
        'Session/Time': 0,
        'Session/Energy': 0
      })
    })

    test('does not set EVSE values in measurement-only mode', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      evcs.initialize({ default_values: true }, ifaceDesc, iface, node)
      expect(iface.Mode).toBeUndefined()
      expect(iface.Status).toBeUndefined()
    })

    test('does not set EVSE values when default values are off', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      evcs.initialize({ evcs_charging_control: true }, ifaceDesc, iface, node)
      expect(iface.Mode).toBeUndefined()
    })
  })

  test('initialize returns a charging control label', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    expect(evcs.initialize({ evcs_charging_control: true }, ifaceDesc, iface, node)).toBe('Virtual 1-phase EV charger (charging control)')
  })
})

describe('evcs S2 support', () => {
  beforeEach(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { jest.restoreAllMocks() })

  function initialize (config) {
    const fixtures = makeFixtures()
    fixtures.node.send = jest.fn()
    fixtures.node.setValuesLocally = jest.fn()
    fixtures.ifaceDesc.properties = evcs.properties(config)
    evcs.initialize(config, fixtures.ifaceDesc, fixtures.iface, fixtures.node)
    return fixtures
  }

  test('adds no S2 paths without S2 support', () => {
    const { ifaceDesc } = initialize({ evcs_charging_control: true })
    expect(ifaceDesc.properties['S2/0/Rm']).toBeUndefined()
    expect(ifaceDesc.__s2Handlers).toBeUndefined()
  })

  // Opportunity Loads only needs /S2/0/Rm, so S2 does not depend on charging control.
  test('adds the S2 paths in measurement-only mode', () => {
    const { ifaceDesc, iface } = initialize({ enable_s2support: true, outputs: 2 })
    expect(ifaceDesc.properties['S2/0/Rm']).toBeDefined()
    expect(ifaceDesc.properties['S2/0/Active']).toBeDefined()
    expect(iface['S2/0/Active']).toBe(0)
  })

  // enable_s2support is shared by all device types, so a node switched to EV charger in the
  // editor can carry it without having the S2 output.
  test.each([
    [{ enable_s2support: true, outputs: 1 }],
    [{ enable_s2support: true, outputs: 2, evcs_charging_control: true }],
    [{ enable_s2support: true }]
  ])('adds no S2 paths when the saved outputs have no S2 port (%j)', (config) => {
    const { ifaceDesc } = initialize(config)
    expect(ifaceDesc.properties['S2/0/Rm']).toBeUndefined()
    expect(ifaceDesc.__s2Handlers).toBeUndefined()
  })

  test('sends S2 on output 2 without charging control', () => {
    const { ifaceDesc, node } = initialize({ enable_s2support: true, outputs: 2 })
    ifaceDesc.__s2Handlers.KeepAlive('cem-1')
    expect(node.send).toHaveBeenCalledWith([null, { payload: { command: 'KeepAlive', cemId: 'cem-1' } }])
  })

  test('sends S2 on output 3 with charging control, after the Control output', () => {
    const { ifaceDesc, node } = initialize({ enable_s2support: true, evcs_charging_control: true, outputs: 3 })
    ifaceDesc.__s2Handlers.KeepAlive('cem-1')
    expect(node.send).toHaveBeenCalledWith([null, null, { payload: { command: 'KeepAlive', cemId: 'cem-1' } }])
  })

  test('uses the configured S2 measurement type', () => {
    const { ifaceDesc } = initialize({ enable_s2support: true, outputs: 2, s2_measurement_type: 'L2' })
    expect(ifaceDesc.__s2PowerMeasurementProps).toEqual({ 'Ac/L2/Power': 'ELECTRIC.POWER.L2' })
  })
})
