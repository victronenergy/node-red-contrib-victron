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
    expect(typeof evcs.properties).toBe('object')
    expect(typeof evcs.initialize).toBe('function')
    expect(typeof evcs.getServiceType).toBe('function')
    expect(typeof evcs.productType).toBe('function')
    expect(evcs.supportsS2).not.toBe(true)
  })

  test('getServiceType always returns evcharger', () => {
    expect(evcs.getServiceType()).toBe('evcharger')
    expect(evcs.getServiceType({})).toBe('evcharger')
  })

  test('productType always returns grid', () => {
    expect(evcs.productType()).toBe('grid')
    expect(evcs.productType({})).toBe('grid')
  })

  test('properties omit Position/PhaseSetting', () => {
    expect(evcs.properties.Position).toBeUndefined()
  })

  test('properties include the minimal generic meter fields', () => {
    expect(evcs.properties['Ac/Power']).toBeDefined()
    expect(evcs.properties.IsGenericEnergyMeter.value).toBe(1)
  })

  test('initialize adds phase properties and returns a label', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    const result = evcs.initialize({ evcs_nrofphases: 3 }, ifaceDesc, iface, node)
    expect(ifaceDesc.properties['Ac/L1/Power']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L2/Power']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L3/Power']).toBeDefined()
    expect(iface.Position).toBeUndefined()
    expect(result).toBe('Virtual 3-phase EV charger')
  })

  test('initialize defaults to 1 phase', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    evcs.initialize({}, ifaceDesc, iface, node)
    expect(iface.NrOfPhases).toBe(1)
    expect(ifaceDesc.properties['Ac/L1/Power']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L2/Power']).toBeUndefined()
  })
})
