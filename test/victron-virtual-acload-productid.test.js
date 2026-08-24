// test/victron-virtual-acload-productid.test.js
/* eslint-env jest */
const { addVictronInterfaces } = require('dbus-victron-virtual')
const acload = require('../src/nodes/victron-virtual/device-type/acload')

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

// The AC load's D-Bus service always stays com.victronenergy.acload (see acload.js
// getServiceType) even as a plain generic energy meter, so the productType override is what
// makes the reported ProductId reflect a grid meter instead of an AC load.
describe('virtual acload ProductId', () => {
  test('full device (S2 enabled): acload productType gives AC load ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.acload.virtual_test', acload.productType({ enable_s2support: true })), iface, true, null)
    expect(iface.ProductId).toBe(0xc06a)
  })

  test('generic energy meter mode: grid productType gives grid meter ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.acload.virtual_test', acload.productType({})), iface, true, null)
    expect(iface.ProductId).toBe(0xc062)
  })
})
