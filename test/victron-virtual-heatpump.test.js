// test/victron-virtual-heatpump.test.js
/* eslint-env jest */
const heatpump = require('../src/nodes/victron-virtual/device-type/heatpump')

function makeFixtures () {
  return {
    ifaceDesc: { properties: {} },
    iface: {},
    node: { error: jest.fn() }
  }
}

describe('heatpump device module', () => {
  test('exports required contract', () => {
    expect(typeof heatpump.properties).toBe('function')
    expect(typeof heatpump.getServiceType).toBe('function')
    expect(typeof heatpump.productType).toBe('function')
    expect(typeof heatpump.initialize).toBe('function')
    expect(typeof heatpump.onPropertiesChanged).toBe('function')
    expect(heatpump.supportsS2).toBe(true)
  })

  describe('full device (S2 support enabled)', () => {
    test('getServiceType returns heatpump', () => {
      expect(heatpump.getServiceType({ enable_s2support: true })).toBe('heatpump')
    })

    test('productType returns heatpump', () => {
      expect(heatpump.productType({ enable_s2support: true })).toBe('heatpump')
    })

    test('properties include Position', () => {
      expect(heatpump.properties({ enable_s2support: true }).Position).toBeDefined()
    })

    test('properties declare IsGenericEnergyMeter as 0', () => {
      expect(heatpump.properties({ enable_s2support: true }).IsGenericEnergyMeter.value).toBe(0)
    })

    test('initialize sets Position/PhaseSetting for single phase', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = heatpump.initialize({ heatpump_nrofphases: 1, heatpump_phasesetting: 2, enable_s2support: true }, ifaceDesc, iface, node)
      expect(iface.Position).toBe(0)
      expect(iface.PhaseSetting).toBe(2)
      expect(ifaceDesc.properties['Ac/L2/Power']).toBeDefined()
      expect(result).toBe('Virtual 1-phase heat pump')
    })

    test('initialize adds L1-L3 for 3-phase', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      heatpump.initialize({ heatpump_nrofphases: 3, enable_s2support: true }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L1/Power']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L2/Power']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L3/Power']).toBeDefined()
    })

    test('S2 support enabled exposes transport properties only, no RmSettings', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      heatpump.initialize({ heatpump_nrofphases: 1, enable_s2support: true }, ifaceDesc, iface, node)
      expect(ifaceDesc.__enableS2).toBe(true)
      expect(ifaceDesc.properties['S2/0/Active']).toBeDefined()
      expect(Object.keys(ifaceDesc.properties).some(k => k.startsWith('S2/0/RmSettings/'))).toBe(false)
    })

    test('onPropertiesChanged accumulates energy when heatpump_auto_energy is true', () => {
      const instance = { 'Ac/L1/Power': 500 }
      const changes = { 'Ac/L1/Power': 600 }
      const result = heatpump.onPropertiesChanged({
        changes,
        instance,
        config: { heatpump_auto_energy: true, heatpump_nrofphases: 1, enable_s2support: true }
      })
      expect(result).toBe(changes)
    })

    test('onPropertiesChanged is a no-op when heatpump_auto_energy is false', () => {
      const instance = { 'Ac/L1/Power': 500 }
      const changes = { 'Ac/L1/Power': 600 }
      const result = heatpump.onPropertiesChanged({
        changes,
        instance,
        config: { heatpump_auto_energy: false, heatpump_nrofphases: 1, enable_s2support: true }
      })
      expect(result['Ac/Energy/Forward']).toBeUndefined()
    })
  })

  describe('generic energy meter mode (S2 support disabled)', () => {
    test('getServiceType still returns heatpump', () => {
      expect(heatpump.getServiceType({})).toBe('heatpump')
    })

    test('productType returns grid', () => {
      expect(heatpump.productType({})).toBe('grid')
    })

    test('properties omit Position', () => {
      expect(heatpump.properties({}).Position).toBeUndefined()
    })

    test('properties declare IsGenericEnergyMeter as 1', () => {
      expect(heatpump.properties({}).IsGenericEnergyMeter.value).toBe(1)
    })

    test('initialize does not add Position/PhaseSetting or S2 support', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = heatpump.initialize({ heatpump_nrofphases: 1 }, ifaceDesc, iface, node)
      expect(iface.Position).toBeUndefined()
      expect(iface.PhaseSetting).toBeUndefined()
      expect(ifaceDesc.__enableS2).toBeUndefined()
      expect(result).toBe('Virtual 1-phase heat pump (generic energy meter)')
    })

    test('onPropertiesChanged still accumulates energy when heatpump_auto_energy is true', () => {
      const instance = { 'Ac/L1/Power': 500 }
      const changes = { 'Ac/L1/Power': 600 }
      const result = heatpump.onPropertiesChanged({
        changes,
        instance,
        config: { heatpump_auto_energy: true, heatpump_nrofphases: 1 }
      })
      expect(result['Ac/Energy/Forward']).toBeDefined()
    })
  })
})
