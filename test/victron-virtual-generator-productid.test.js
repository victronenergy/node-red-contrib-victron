// test/victron-virtual-generator-productid.test.js
/* eslint-env jest */
const { addVictronInterfaces } = require('dbus-victron-virtual')
const generator = require('../src/nodes/victron-virtual/device-type/generator')

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

// The genset's D-Bus service stays com.victronenergy.genset even in "Use as grid meter only"
// mode (see generator.js getServiceType), so the productType override is what makes the
// reported ProductId reflect a grid meter instead of a genset.
describe('virtual generator (genset) ProductId in grid meter only mode', () => {
  test('normal mode: genset productType gives genset ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.genset.virtual_test', generator.productType({ generator_type: 'ac' })), iface, true, null)
    expect(iface.ProductId).toBe(0xc06b)
  })

  test('grid meter only mode: grid productType gives grid meter ProductId', () => {
    const iface = { emit: jest.fn(), Connected: 1 }
    addVictronInterfaces(makeBus(), makeIfaceDesc('com.victronenergy.genset.virtual_test', generator.productType({ generator_type: 'ac', generator_grid_meter_only: true })), iface, true, null)
    expect(iface.ProductId).toBe(0xc062)
  })
})
