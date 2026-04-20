// test/victron-virtual-generator-productid.test.js
/* eslint-env jest */
const { addVictronInterfaces } = require('dbus-victron-virtual')

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

// These tests verify issue #458: virtual genset/dcgenset missing /ProductId.
// The root cause: index.js sets ifaceDesc.productType = config.device ('generator'),
// but 'generator' is not in dbus-victron-virtual's products list.
// Without productType, the library extracts 'genset'/'dcgenset' from the service
// name, which ARE valid products.

describe('virtual generator ProductId (#458)', () => {
  test('productType "generator" prevents ProductId from being set', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.genset.virtual_test', 'generator'), iface, true, null)
    expect(iface.ProductId).toBeUndefined()
  })

  test('genset without productType override gets ProductId from service name', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.genset.virtual_test'), iface, true, null)
    expect(iface.ProductId).toBe(0xc06b)
  })

  test('dcgenset without productType override gets ProductId from service name', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.dcgenset.virtual_test'), iface, true, null)
    expect(iface.ProductId).toBe(0xc06d)
  })

  test('e-drive productType "e-drive" prevents ProductId from being set', () => {
    const iface = { emit: jest.fn() }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.motordrive.virtual_test', 'e-drive'), iface, true, null)
    expect(iface.ProductId).toBeUndefined()
  })

  test('motordrive without productType override gets ProductId from service name', () => {
    const iface = { emit: jest.fn() }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.motordrive.virtual_test'), iface, true, null)
    expect(iface.ProductId).toBe(0xc06c)
  })
})
