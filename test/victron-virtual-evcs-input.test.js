/* eslint-env jest */
const { addVictronInterfaces } = require('dbus-victron-virtual')
const evcs = require('../src/nodes/victron-virtual/device-type/evcs')
const { createDebouncedSetters } = require('../src/nodes/victron-virtual-dbus-helpers')
const { debounce } = require('../src/services/utils')

const HOUR = 3600 * 1000
const DELAY = 100

// The node input debounces each payload key; this checks the keys of one message still reach
// onPropertiesChanged together, so the session and energy calculations see the whole message.
describe('evcs payloads through the debounced node input', () => {
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

  function setup (config, instance) {
    // index.js (getIfaceDesc) hands initialize copies of the property definitions
    const properties = Object.fromEntries(Object.entries(evcs.properties(config)).map(([key, value]) => [key, { ...value }]))
    const ifaceDesc = { name: 'com.victronenergy.evcharger.virtual_test', properties, productType: evcs.productType() }
    const iface = { emit: jest.fn() }
    evcs.initialize(config, ifaceDesc, iface, null)
    Object.assign(iface, instance)
    const bus = { exportInterface: jest.fn() }
    const { setValuesLocally } = addVictronInterfaces(bus, ifaceDesc, iface, true, null,
      ({ changes, instance }) => evcs.onPropertiesChanged({ changes, instance, config }))
    const node = {
      ifaceDesc,
      setValuesLocally,
      error: jest.fn()
    }
    node.iface = iface
    const { applyInput: input } = createDebouncedSetters(node, debounce, DELAY)
    const send = (payload) => {
      input(payload)
      jest.advanceTimersByTime(DELAY)
    }
    return { input, send, iface }
  }

  test('a session energy sent with a plug-in Status is kept', () => {
    const config = { evcs_charging_control: true, evcs_auto_session: true }
    const { send, iface } = setup(config, { Status: 0, 'Session/Energy': 0 })

    send({ '/Session/Energy': 3.2, '/Status': 2 })

    expect(iface['Session/Energy']).toBe(3.2)
  })

  test('phase power sent before Ac/Power is not counted twice', () => {
    const config = { evcs_auto_energy: true, evcs_nrofphases: 1 }
    const { send, iface } = setup(config, { 'Ac/Energy/Forward': 0 })

    send({ '/Ac/L1/Power': 1000, '/Ac/Power': 1000 })
    now += HOUR
    send({ '/Ac/L1/Power': 1000, '/Ac/Power': 1000 })

    expect(iface['Ac/Energy/Forward']).toBeCloseTo(1, 5)
  })

  test('an unplug and replug within the debounce delay starts a new session', () => {
    const config = { evcs_charging_control: true, evcs_auto_session: true }
    const { input, iface } = setup(config, { Status: 3, 'Session/Energy': 12, 'Session/Time': 3600 })

    input({ '/Status': 0 })
    jest.advanceTimersByTime(DELAY / 2)
    input({ '/Status': 1 })
    jest.advanceTimersByTime(DELAY)

    expect(iface).toMatchObject({ Status: 1, 'Session/Energy': 0, 'Session/Time': 0 })
  })

  // Review on #616: Status was applied before the energy of the same message
  test('energy sent with a plug-in Status is not counted in the new session', () => {
    const config = { evcs_charging_control: true, evcs_auto_session: true }
    const { send, iface } = setup(config, { Status: 0, 'Session/Energy': 2 })
    send({ '/Ac/Energy/Forward': 12 })

    send({ '/Status': 1, '/Ac/Energy/Forward': 13 })
    expect(iface['Session/Energy']).toBe(0)
    send({ '/Ac/Energy/Forward': 14 })
    expect(iface['Session/Energy']).toBeCloseTo(1, 5)
  })

  test('energy still pending from before a plug-in is not counted in the new session', () => {
    const config = { evcs_charging_control: true, evcs_auto_session: true }
    const { input, send, iface } = setup(config, { Status: 0, 'Session/Energy': 2 })
    send({ '/Ac/Energy/Forward': 12 })

    input({ '/Ac/Energy/Forward': 13 })
    jest.advanceTimersByTime(DELAY / 2)
    send({ '/Status': 1 })
    send({ '/Ac/Energy/Forward': 14 })

    expect(iface['Session/Energy']).toBeCloseTo(1, 5)
  })

  test('a fast stream of power updates does not hold back Status or control paths', () => {
    const config = { evcs_charging_control: true, evcs_auto_session: true }
    const { input, iface } = setup(config, { Status: 1, StartStop: 0 })

    input({ '/Status': 2, '/StartStop': 1 })
    for (let i = 0; i < 10; i++) {
      input({ '/Ac/Power': 7000 + i })
      jest.advanceTimersByTime(DELAY / 2)
    }

    expect(iface).toMatchObject({ Status: 2, StartStop: 1 })
  })
})
