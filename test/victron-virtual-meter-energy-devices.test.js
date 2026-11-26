/* eslint-env jest */
// How each energy meter device hands its config to accumulateMeterEnergy. The calculation itself
// is tested in victron-virtual-meter-energy.test.js.
const acload = require('../src/nodes/victron-virtual/device-type/acload')
const heatpump = require('../src/nodes/victron-virtual/device-type/heatpump')
const pvinverter = require('../src/nodes/victron-virtual/device-type/pvinverter')
const evcs = require('../src/nodes/victron-virtual/device-type/evcs')
const { addVictronInterfaces } = require('dbus-victron-virtual')
const { createDebouncedSetters } = require('../src/nodes/victron-virtual-dbus-helpers')
const { debounce } = require('../src/services/utils')

const HOUR = 3600 * 1000
const DELAY = 100

// index.js (getIfaceDesc) hands initialize copies of the property definitions
function ifaceDescFor (device, config) {
  const definitions = typeof device.properties === 'function' ? device.properties(config) : device.properties
  return { properties: Object.fromEntries(Object.entries(definitions).map(([key, value]) => [key, { ...value }])) }
}

const devices = [
  ['acload', acload],
  ['heatpump', heatpump],
  ['pvinverter', pvinverter],
  ['evcs', evcs]
]

describe.each(devices)('%s auto energy', (prefix, device) => {
  let now
  beforeEach(() => {
    now = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => jest.restoreAllMocks())

  // Sends the same values an hour apart and applies the result, as dbus-victron-virtual does
  function runForAnHour (config, values, instance = {}) {
    config = { [`${prefix}_auto_energy`]: true, ...config }
    const apply = () => Object.assign(instance, device.onPropertiesChanged({ changes: { ...values }, instance, config }))
    apply()
    now += HOUR
    apply()
    return instance
  }

  test('integrates Ac/Power into Ac/Energy/Forward', () => {
    const instance = runForAnHour({}, { 'Ac/Power': 1000 }, { 'Ac/Energy/Forward': 10 })
    expect(instance['Ac/Energy/Forward']).toBeCloseTo(11, 5)
  })

  test('does not count the time the device was offline', () => {
    const config = { [`${prefix}_auto_energy`]: true }
    const instance = { 'Ac/Energy/Forward': 10 }
    const sendPower = () => Object.assign(instance, device.onPropertiesChanged({ changes: { 'Ac/Power': 2000 }, instance, config }))

    sendPower()
    device.onPresenceChange(instance, false)
    now += 8 * HOUR
    device.onPresenceChange(instance, true)
    sendPower()

    expect(instance['Ac/Energy/Forward']).toBe(10)
  })

  test('counts all phases of a three-phase device', () => {
    const instance = runForAnHour({ [`${prefix}_nrofphases`]: 3 }, { 'Ac/L1/Power': 1000, 'Ac/L2/Power': 2000, 'Ac/L3/Power': 3000 })
    expect(instance['Ac/L3/Energy/Forward']).toBeCloseTo(3, 5)
  })

  test('ignores phases beyond the configured number', () => {
    const instance = runForAnHour({ [`${prefix}_nrofphases`]: 1 }, { 'Ac/L3/Power': 1000 })
    expect(instance['Ac/L3/Energy/Forward']).toBeUndefined()
  })

  test.each([
    ['off', false],
    ['undefined (deployed nodes from before the option)', undefined]
  ])('does nothing when auto energy is %s', (_, autoEnergy) => {
    const instance = runForAnHour({ [`${prefix}_auto_energy`]: autoEnergy }, { 'Ac/Power': 1000 })
    expect(instance['Ac/Energy/Forward']).toBeUndefined()
    // So turning auto energy on later doesn't count the time it was off
    expect(instance._lastPowerTimestamp).toBeUndefined()
  })

  if (prefix !== 'pvinverter') {
    test('accumulates on the configured phase of a single-phase device', () => {
      const instance = runForAnHour({ [`${prefix}_nrofphases`]: 1, [`${prefix}_phasesetting`]: 3 }, { 'Ac/L3/Power': 500 })
      expect(instance['Ac/L3/Energy/Forward']).toBeCloseTo(0.5, 5)
      expect(instance['Ac/L1/Energy/Forward']).toBeUndefined()
    })
  }
})

// The EV charger groups its keys itself, also without auto energy
test.each(devices.filter(([prefix]) => prefix !== 'evcs'))('%s keeps its input keys apart without auto energy', (prefix, device) => {
  const ifaceDesc = ifaceDescFor(device, {})
  device.initialize({}, ifaceDesc, {}, { error: jest.fn() })
  expect(Object.values(ifaceDesc.properties).some(property => property.debounceGroup)).toBe(false)
})

test.each(devices.filter(([prefix]) => prefix !== 'evcs'))('%s groups only the power and energy paths', (prefix, device) => {
  const config = { [`${prefix}_auto_energy`]: true }
  const ifaceDesc = ifaceDescFor(device, config)
  device.initialize(config, ifaceDesc, {}, { error: jest.fn() })
  const grouped = Object.keys(ifaceDesc.properties).filter(key => ifaceDesc.properties[key].debounceGroup)
  expect(grouped).toEqual(expect.arrayContaining(['Ac/Power', 'Ac/Energy/Forward', 'Ac/L1/Power', 'Ac/L1/Energy/Forward']))
  expect(grouped).not.toContain('Ac/L1/Voltage')
})

// The node input debounces each payload key; the keys of one message must reach the energy
// calculation together, or the order of the keys decides which counters grow.
describe.each(devices)('%s payloads through the debounced node input', (prefix, device) => {
  let now
  beforeEach(() => {
    jest.useFakeTimers()
    now = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  function setup (instance) {
    const config = { [`${prefix}_auto_energy`]: true }
    const ifaceDesc = { name: `com.victronenergy.${prefix}.virtual_test`, ...ifaceDescFor(device, config) }
    const iface = { emit: jest.fn() }
    device.initialize(config, ifaceDesc, iface, { error: jest.fn() })
    Object.assign(iface, instance)
    const totals = []
    const { setValuesLocally } = addVictronInterfaces({ exportInterface: jest.fn() }, ifaceDesc, iface, true, null, ({ changes, instance }) => {
      const result = device.onPropertiesChanged({ changes, instance, config })
      if ('Ac/Energy/Forward' in result) totals.push(result['Ac/Energy/Forward'])
      return result
    })
    const { applyInput } = createDebouncedSetters({ ifaceDesc, iface, setValuesLocally, error: jest.fn() }, debounce, DELAY)
    const send = (payload) => {
      applyInput(payload)
      jest.advanceTimersByTime(DELAY)
    }
    return { send, iface, totals }
  }

  test('a phase power sent before Ac/Power keeps its phase counter growing', () => {
    const { send, iface } = setup({ 'Ac/Energy/Forward': 0, 'Ac/L1/Energy/Forward': 0 })
    send({ '/Ac/L1/Power': 1000, '/Ac/Power': 1000 })
    now += HOUR
    send({ '/Ac/L1/Power': 1000, '/Ac/Power': 1000 })
    expect(iface['Ac/L1/Energy/Forward']).toBeCloseTo(1, 5)
    expect(iface['Ac/Energy/Forward']).toBeCloseTo(1, 5)
  })

  test('a value the D-Bus service rejects does not drop the rest of the message', () => {
    const { send, iface } = setup({})
    send({ '/Ac/Power': 1000, '/Ac/L1/Voltage': [230] })
    expect(iface['Ac/Power']).toBe(1000)
  })

  test('an empty array is still applied, as D-Bus accepts it', () => {
    const { send, iface } = setup({ 'Ac/L1/Voltage': 230 })
    send({ '/Ac/Power': 1000, '/Ac/L1/Voltage': [] })
    expect(iface['Ac/L1/Voltage']).toBe(0)
  })

  test('a reset of the total and phase counters in one message sets them to 0', () => {
    const { send, iface } = setup({ 'Ac/Energy/Forward': 100, 'Ac/L1/Energy/Forward': 100 })
    send({ '/Ac/Energy/Forward': 0, '/Ac/L1/Energy/Forward': 0 })
    expect(iface['Ac/Energy/Forward']).toBe(0)
  })

  test('a total the flow reports with its phase counters is taken as is', () => {
    const { send, totals } = setup({ 'Ac/Energy/Forward': 10, 'Ac/L1/Energy/Forward': 10 })
    send({ '/Ac/Energy/Forward': 11, '/Ac/L1/Energy/Forward': 11 })
    send({ '/Ac/Energy/Forward': 12, '/Ac/L1/Energy/Forward': 12 })
    expect(totals).toEqual([11, 12])
  })
})
