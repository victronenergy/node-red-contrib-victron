// test/victron-virtual-heatpump-productid.test.js
/* eslint-env jest */
const { addVictronInterfaces } = require('dbus-victron-virtual')
const heatpump = require('../src/nodes/victron-virtual/device-type/heatpump')

function makeBus () {
  return { exportInterface: jest.fn() }
}

function makeIfaceDesc (name, productType) {
  const desc = {
    name,
    methods: {},
    properties: { Connected: { type: 'i' } },
    signals: {}
  }
  if (productType !== undefined) {
    desc.productType = productType
  }
  return desc
}

// The heatpump's D-Bus service always stays com.victronenergy.heatpump (see heatpump.js
// getServiceType) even as a plain generic energy meter, so the productType override is what
// makes the reported ProductId reflect a grid meter instead of a heat pump.
describe('virtual heatpump ProductId', () => {
  test('full device (S2 enabled): heatpump productType gives heatpump ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.heatpump.virtual_test', heatpump.productType({ enable_s2support: true })), iface, true, null)
    expect(iface.ProductId).toBe(0xc064)
  })

  test('generic energy meter mode: grid productType gives grid meter ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.heatpump.virtual_test', heatpump.productType({})), iface, true, null)
    expect(iface.ProductId).toBe(0xc062)
  })
})
