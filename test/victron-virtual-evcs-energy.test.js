/* eslint-env jest */
const evcs = require('../src/nodes/victron-virtual/device-type/evcs')

const HOUR = 3600 * 1000

describe('evcs auto energy', () => {
  let now
  beforeEach(() => {
    now = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => jest.restoreAllMocks())

  // Calls onPropertiesChanged and applies the result to the instance, as dbus-victron-virtual does.
  function apply (instance, changes, config) {
    const result = evcs.onPropertiesChanged({ changes: { ...changes }, instance, config })
    Object.assign(instance, result)
    return result
  }

  test('integrates Ac/Power into Ac/Energy/Forward', () => {
    const config = { evcs_auto_energy: true, evcs_nrofphases: 1 }
    const instance = { 'Ac/Energy/Forward': 10 }
    apply(instance, { 'Ac/Power': 3600 }, config)
    now += HOUR
    apply(instance, { 'Ac/Power': 3600 }, config)
    expect(instance['Ac/Energy/Forward']).toBeCloseTo(13.6, 5)
  })

  test('works without charging control', () => {
    const config = { evcs_auto_energy: true, evcs_charging_control: false }
    const instance = {}
    apply(instance, { 'Ac/Power': 1000 }, config)
    now += HOUR
    apply(instance, { 'Ac/Power': 1000 }, config)
    expect(instance['Ac/Energy/Forward']).toBeCloseTo(1, 5)
  })

  test('accumulates on the configured phase of a single-phase charger', () => {
    const config = { evcs_auto_energy: true, evcs_nrofphases: 1, evcs_phasesetting: 2 }
    const instance = {}
    apply(instance, { 'Ac/L2/Power': 2000 }, config)
    now += HOUR
    apply(instance, { 'Ac/L2/Power': 2000 }, config)
    expect(instance['Ac/L2/Energy/Forward']).toBeCloseTo(2, 5)
    expect(instance['Ac/L1/Energy/Forward']).toBeUndefined()
    expect(instance['Ac/Energy/Forward']).toBeCloseTo(2, 5)
  })

  test('sums all phases of a three-phase charger', () => {
    const config = { evcs_auto_energy: true, evcs_nrofphases: 3 }
    const powers = { 'Ac/L1/Power': 1000, 'Ac/L2/Power': 2000, 'Ac/L3/Power': 3000 }
    const instance = {}
    apply(instance, powers, config)
    now += HOUR
    apply(instance, powers, config)
    expect(instance['Ac/Energy/Forward']).toBeCloseTo(6, 5)
  })

  test.each([
    ['off', { evcs_auto_energy: false }],
    ['undefined (deployed nodes from before the option)', {}]
  ])('does nothing when evcs_auto_energy is %s', (_, config) => {
    const instance = {}
    apply(instance, { 'Ac/Power': 1000 }, config)
    now += HOUR
    const result = apply(instance, { 'Ac/Power': 1000 }, config)
    expect(result).toEqual({ 'Ac/Power': 1000 })
  })

  test('runs alongside the session counters', () => {
    const config = { evcs_auto_energy: true, evcs_charging_control: true, evcs_auto_session: true }
    const instance = { Status: 2, 'Session/Energy': 0, 'Session/Time': 0, 'Ac/Energy/Forward': 100 }
    apply(instance, { 'Ac/Power': 7200 }, config)
    now += HOUR
    apply(instance, { 'Ac/Power': 7200 }, config)
    expect(instance['Session/Energy']).toBeCloseTo(7.2, 5)
    expect(instance['Ac/Energy/Forward']).toBeCloseTo(107.2, 5)
  })
})
