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

  test('properties include Position with AC output/AC input formatting', () => {
    expect(evcs.properties.Position).toBeDefined()
    expect(evcs.properties.Position.format(0)).toBe('AC output')
    expect(evcs.properties.Position.format(1)).toBe('AC input')
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
