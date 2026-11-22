// test/victron-virtual-acload.test.js
/* eslint-env jest */
const acload = require('../src/nodes/victron-virtual/device-type/acload')

describe('acload device module', () => {
  test('exports required contract', () => {
    expect(typeof acload.properties).toBe('function')
    expect(typeof acload.getServiceType).toBe('function')
    expect(typeof acload.productType).toBe('function')
    expect(typeof acload.initialize).toBe('function')
    expect(typeof acload.onPropertiesChanged).toBe('function')
  })

  describe('generic energy meter vs full device (S2 support)', () => {
    test('getServiceType always returns acload', () => {
      expect(acload.getServiceType({ enable_s2support: true })).toBe('acload')
      expect(acload.getServiceType({ enable_s2support: false })).toBe('acload')
      expect(acload.getServiceType({})).toBe('acload')
    })

    test('productType returns acload when S2 enabled, grid otherwise', () => {
      expect(acload.productType({ enable_s2support: true })).toBe('acload')
      expect(acload.productType({ enable_s2support: false })).toBe('grid')
      expect(acload.productType({})).toBe('grid')
    })

    test('properties include Position regardless of S2 support', () => {
      expect(acload.properties({ enable_s2support: true }).Position).toBeDefined()
      expect(acload.properties({ enable_s2support: false }).Position).toBeDefined()
      expect(acload.properties({}).Position).toBeDefined()
    })

    test('properties declare IsGenericEnergyMeter as 0 when S2 enabled, 1 otherwise', () => {
      expect(acload.properties({ enable_s2support: true }).IsGenericEnergyMeter.value).toBe(0)
      expect(acload.properties({ enable_s2support: false }).IsGenericEnergyMeter.value).toBe(1)
      expect(acload.properties({}).IsGenericEnergyMeter.value).toBe(1)
    })

    test('properties do not expose S2/0/RmSettings/* in either mode', () => {
      const generic = acload.properties({ enable_s2support: false })
      const full = acload.properties({ enable_s2support: true })
      expect(Object.keys(generic).some(k => k.startsWith('S2/0/RmSettings/'))).toBe(false)
      expect(Object.keys(full).some(k => k.startsWith('S2/0/RmSettings/'))).toBe(false)
    })

    test('initialize still adds Position/PhaseSetting when S2 is disabled', () => {
      const ifaceDesc = { properties: {} }
      const iface = {}
      const node = { error: jest.fn() }
      acload.initialize({ acload_nrofphases: 1, acload_position: 1, acload_phasesetting: 2 }, ifaceDesc, iface, node)
      expect(iface.Position).toBe(1)
      expect(iface.PhaseSetting).toBe(2)
      expect(ifaceDesc.properties.PhaseSetting).toBeDefined()
      expect(ifaceDesc.properties['Ac/L2/Power']).toBeDefined()
    })

    test('initialize returns the generic energy meter label when S2 is disabled', () => {
      const ifaceDesc = { properties: {} }
      const iface = {}
      const node = { error: jest.fn() }
      const result = acload.initialize({ acload_nrofphases: 1 }, ifaceDesc, iface, node)
      expect(result).toBe('Virtual 1-phase AC load (generic energy meter)')
    })
  })
})
