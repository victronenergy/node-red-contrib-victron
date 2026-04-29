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

// These tests verify library behavior: what productType values produce which ProductIds.
// They document why index.js must not set an invalid productType on ifaceDesc.

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

// These tests verify the regression from commit 970cf0c0: energy meters must keep
// ProductId 0xc06f regardless of the Venus OS service type they register under.
// An energy meter in 'acload' role registers as com.victronenergy.acload.xxx but
// must still report as an energy meter, not an AC load.

describe('virtual energy meter ProductId (970cf0c0 regression)', () => {
  test('acload service without productType override gets acload ProductId, not energymeter', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.acload.virtual_test'), iface, true, null)
    expect(iface.ProductId).toBe(0xc06a)
  })

  test('productType "energymeter" on acload service gives energy meter ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.acload.virtual_test', 'energymeter'), iface, true, null)
    expect(iface.ProductId).toBe(0xc06f)
  })

  test('productType "energymeter" on pvinverter service gives energy meter ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.pvinverter.virtual_test', 'energymeter'), iface, true, null)
    expect(iface.ProductId).toBe(0xc06f)
  })

  test('productType "energymeter" on grid service gives energy meter ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.grid.virtual_test', 'energymeter'), iface, true, null)
    expect(iface.ProductId).toBe(0xc06f)
  })
})
