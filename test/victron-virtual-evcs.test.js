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
    expect(evcs.supportsS2).not.toBe(true)
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
  const PERSISTED_SETTINGS = ['Mode', 'AutoStart', 'EnableDisplay', 'SetCurrent', 'MinCurrent', 'MaxCurrent']

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
