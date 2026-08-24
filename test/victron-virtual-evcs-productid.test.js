// test/victron-virtual-evcs-productid.test.js
/* eslint-env jest */
const { addVictronInterfaces } = require('dbus-victron-virtual')
const evcs = require('../src/nodes/victron-virtual/device-type/evcs')

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

describe('virtual evcs ProductId', () => {
  test('evcharger service without productType override gets no ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.evcharger.virtual_test'), iface, true, null)
    expect(iface.ProductId).toBeUndefined()
  })

  test('grid productType override gives grid meter ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.evcharger.virtual_test', evcs.productType()), iface, true, null)
    expect(iface.ProductId).toBe(0xc062)
  })
})
