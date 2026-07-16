// test/victron-virtual-s2-support.test.js
/* eslint-env jest */

const { enableS2Support } = require('../src/nodes/victron-virtual/s2-support')

function makeFixtures () {
  return {
    ifaceDesc: { properties: {} },
    iface: {},
    node: { send: jest.fn(), setValuesLocally: jest.fn() }
  }
}

describe('enableS2Support', () => {
  test('is a no-op when config.enable_s2support is falsy', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: {}, ifaceDesc, iface, node })
    expect(ifaceDesc.__enableS2).toBeUndefined()
    expect(ifaceDesc.__s2PowerMeasurementProps).toBeUndefined()
    expect(ifaceDesc.__s2Handlers).toBeUndefined()
    expect(ifaceDesc.properties).toEqual({})
    expect(iface).toEqual({})
  })

  test('sets __enableS2 and the generic transport properties/defaults when enabled, with no resource settings by default', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node })
    expect(ifaceDesc.__enableS2).toBe(true)
    expect(ifaceDesc.properties['S2/0/Active']).toEqual({ type: 'i' })
    expect(ifaceDesc.properties['S2/0/Rm']).toBeDefined()
    expect(iface['S2/0/Active']).toBe(0)
    expect(iface['S2/0/Rm']).toBe('')
    expect(Object.keys(ifaceDesc.properties)).toEqual(['S2/0/Active', 'S2/0/Rm'])
  })

  test('merges caller-supplied resourceProperties/resourceDefaults alongside the transport properties', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    // A stand-in for a non-load resource shape (e.g. a producer's curtailment limit) - proves
    // enableS2Support doesn't assume any particular resource-settings schema.
    const resourceProperties = {
      'S2/0/RmSettings/CurtailmentLimit': { type: 'i' }
    }
    const resourceDefaults = {
      'S2/0/RmSettings/CurtailmentLimit': 500
    }
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node, resourceProperties, resourceDefaults })
    expect(ifaceDesc.properties['S2/0/Active']).toEqual({ type: 'i' })
    expect(ifaceDesc.properties['S2/0/Rm']).toBeDefined()
    expect(ifaceDesc.properties['S2/0/RmSettings/CurtailmentLimit']).toEqual({ type: 'i' })
    expect(iface['S2/0/Active']).toBe(0)
    expect(iface['S2/0/Rm']).toBe('')
    expect(iface['S2/0/RmSettings/CurtailmentLimit']).toBe(500)
  })

  test('defaults to 3_PHASE_SYMMETRIC measurement props when s2_measurement_type is absent', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node })
    expect(ifaceDesc.__s2PowerMeasurementProps).toEqual({
      'Ac/Power': 'ELECTRIC.POWER.3_PHASE_SYMMETRIC'
    })
  })

  test.each([
    ['L1_L2_L3', { 'Ac/L1/Power': 'ELECTRIC.POWER.L1', 'Ac/L2/Power': 'ELECTRIC.POWER.L2', 'Ac/L3/Power': 'ELECTRIC.POWER.L3' }],
    ['L1', { 'Ac/L1/Power': 'ELECTRIC.POWER.L1' }],
    ['L2', { 'Ac/L2/Power': 'ELECTRIC.POWER.L2' }],
    ['L3', { 'Ac/L3/Power': 'ELECTRIC.POWER.L3' }]
  ])('uses correct measurement props when s2_measurement_type is %s', (type, expected) => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true, s2_measurement_type: type }, ifaceDesc, iface, node })
    expect(ifaceDesc.__s2PowerMeasurementProps).toEqual(expected)
  })

  test('sets __s2Handlers with all four methods', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node })
    expect(typeof ifaceDesc.__s2Handlers.Connect).toBe('function')
    expect(typeof ifaceDesc.__s2Handlers.Disconnect).toBe('function')
    expect(typeof ifaceDesc.__s2Handlers.Message).toBe('function')
    expect(typeof ifaceDesc.__s2Handlers.KeepAlive).toBe('function')
  })

  test('Connect handler updates S2 active/rm and sends command on port 2', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node })
    node._s2PowerMeasurementActive = true
    node._s2PowerMeasurementCemId = 'old-cem'
    ifaceDesc.__s2Handlers.Connect('cem-1', 30)
    expect(node._s2PowerMeasurementActive).toBe(false)
    expect(node._s2PowerMeasurementCemId).toBeNull()
    expect(node.setValuesLocally).toHaveBeenCalledWith({ 'S2/0/Active': 1, 'S2/0/Rm': 'CEM: cem-1' })
    expect(node.send).toHaveBeenCalledWith([null, {
      payload: { command: 'Connect', cemId: 'cem-1', keepAliveInterval: 30 }
    }])
  })

  test('Disconnect handler clears S2 active/rm and sends command on port 2', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node })
    node._s2PowerMeasurementActive = true
    node._s2PowerMeasurementCemId = 'cem-1'
    ifaceDesc.__s2Handlers.Disconnect('cem-1')
    expect(node._s2PowerMeasurementActive).toBe(false)
    expect(node._s2PowerMeasurementCemId).toBeNull()
    expect(node.setValuesLocally).toHaveBeenCalledWith({ 'S2/0/Active': 0, 'S2/0/Rm': '' })
    expect(node.send).toHaveBeenCalledWith([null, {
      payload: { command: 'Disconnect', cemId: 'cem-1' }
    }])
  })

  test('Message handler sends command on port 2 with the message payload', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node })
    ifaceDesc.__s2Handlers.Message('cem-1', { foo: 'bar' })
    expect(node.send).toHaveBeenCalledWith([null, {
      payload: { command: 'Message', cemId: 'cem-1', message: { foo: 'bar' } }
    }])
  })

  test('KeepAlive handler sends command on port 2 and returns true', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node })
    const result = ifaceDesc.__s2Handlers.KeepAlive('cem-1')
    expect(node.send).toHaveBeenCalledWith([null, {
      payload: { command: 'KeepAlive', cemId: 'cem-1' }
    }])
    expect(result).toBe(true)
  })

  test('reflects deviceLabel in the startup console.warn', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { ifaceDesc, iface, node } = makeFixtures()
    enableS2Support({ config: { enable_s2support: true }, ifaceDesc, iface, node, deviceLabel: 'my-custom-acload' })
    expect(warnSpy).toHaveBeenCalledWith('S2 support for my-custom-acload virtual device is experimental.')
    warnSpy.mockRestore()
  })
})
