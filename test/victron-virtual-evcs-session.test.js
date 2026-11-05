/* eslint-env jest */
const evcs = require('../src/nodes/victron-virtual/device-type/evcs')

const CONFIG = { evcs_charging_control: true, evcs_auto_session: true }
const HOUR = 3600 * 1000

describe('evcs session accumulation', () => {
  let now
  beforeEach(() => {
    now = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => jest.restoreAllMocks())

  function charging (extra = {}) {
    return { Status: 2, 'Ac/Power': 7200, 'Session/Energy': 0, 'Session/Time': 0, ChargingTime: 0, ...extra }
  }

  // Calls onPropertiesChanged and applies the result to the instance, as dbus-victron-virtual does.
  function apply (instance, changes, config = CONFIG) {
    const result = evcs.onPropertiesChanged({ changes: { ...changes }, instance, config })
    Object.assign(instance, result)
    return result
  }

  test('accumulates energy and time while charging', () => {
    const instance = charging()
    apply(instance, { 'Ac/Power': 7200 })
    now += HOUR
    apply(instance, { 'Ac/Power': 7200 })
    expect(instance['Session/Energy']).toBeCloseTo(7.2, 5)
    expect(instance['Session/Time']).toBe(3600)
    expect(instance.ChargingTime).toBe(3600)
  })

  test('does not accumulate while not charging', () => {
    const instance = charging({ Status: 1 })
    apply(instance, { 'Ac/Power': 7200 })
    now += HOUR
    apply(instance, { 'Ac/Power': 7200 })
    expect(instance['Session/Energy']).toBe(0)
    expect(instance['Session/Time']).toBe(0)
  })

  test('counts the charging interval up to a status change', () => {
    const instance = charging()
    apply(instance, { 'Ac/Power': 7200 })
    now += HOUR / 2
    apply(instance, { Status: 3 })
    now += HOUR / 2
    apply(instance, { 'Ac/Power': 0 })
    expect(instance['Session/Energy']).toBeCloseTo(3.6, 5)
    expect(instance['Session/Time']).toBe(1800)
  })

  test('starts a new session when a car is plugged in after the charger was offline', () => {
    const instance = charging({ Status: 0, 'Session/Energy': 12.5, 'Session/Time': 5000, ChargingTime: 5000 })
    apply(instance, { Status: null })
    apply(instance, { Status: 1 })
    expect(instance['Session/Energy']).toBe(0)
    expect(instance['Session/Time']).toBe(0)
  })

  test('keeps the session when the charger was offline while charging', () => {
    const instance = charging({ 'Session/Energy': 12.5, 'Session/Time': 5000, ChargingTime: 5000 })
    apply(instance, { Status: null })
    apply(instance, { Status: 2 })
    expect(instance['Session/Energy']).toBe(12.5)
    expect(instance['Session/Time']).toBe(5000)
  })

  test('starts a new session when a car is plugged in', () => {
    const instance = charging({ Status: 0, 'Session/Energy': 12.5, 'Session/Time': 5000, ChargingTime: 5000 })
    apply(instance, { Status: 1 })
    expect(instance['Session/Energy']).toBe(0)
    expect(instance['Session/Time']).toBe(0)
    expect(instance.ChargingTime).toBe(0)
  })

  test('does not reset the session on other status changes', () => {
    const instance = charging({ 'Session/Energy': 3, 'Session/Time': 100 })
    apply(instance, { Status: 3 })
    expect(instance['Session/Energy']).toBe(3)
  })

  test('explicit flow values win over the calculated ones', () => {
    const instance = charging()
    apply(instance, { 'Ac/Power': 7200 })
    now += HOUR
    apply(instance, { 'Session/Energy': 1, 'Session/Time': 10 })
    expect(instance['Session/Energy']).toBe(1)
    expect(instance['Session/Time']).toBe(10)
    expect(instance.ChargingTime).toBe(10)
    now += 10 * 1000
    apply(instance, { 'Ac/Power': 7200 })
    expect(instance['Session/Time']).toBe(20)
  })

  test('uses the sum of the phase powers when the flow does not send Ac/Power', () => {
    const config = { ...CONFIG, evcs_nrofphases: 3 }
    const powers = { 'Ac/L1/Power': 1000, 'Ac/L2/Power': 2000, 'Ac/L3/Power': 3000 }
    const instance = { Status: 2, 'Session/Energy': 0, 'Session/Time': 0 }
    apply(instance, powers, config)
    now += HOUR
    apply(instance, powers, config)
    expect(instance['Session/Energy']).toBeCloseTo(6, 5)
  })

  test('uses the configured phase of a single-phase charger', () => {
    const config = { ...CONFIG, evcs_nrofphases: 1, evcs_phasesetting: 2 }
    const instance = { Status: 2, 'Session/Energy': 0, 'Session/Time': 0, 'Ac/L1/Power': 500 }
    apply(instance, { 'Ac/L2/Power': 2000 }, config)
    now += HOUR
    apply(instance, { 'Ac/L2/Power': 2000 }, config)
    expect(instance['Session/Energy']).toBeCloseTo(2, 5)
  })

  test('a new session does not inherit time left over from the previous one', () => {
    const instance = charging()
    apply(instance, { 'Ac/Power': 7200 })
    now += 900
    apply(instance, { Status: 0 })
    apply(instance, { Status: 1 })
    apply(instance, { Status: 2 })
    now += 200
    apply(instance, { 'Ac/Power': 7200 })
    expect(instance._sessionSeconds).toBeCloseTo(0.2, 5)
  })

  test('a cleared Status does not start a new session', () => {
    const instance = charging({ Status: 0, 'Session/Energy': 4, 'Session/Time': 100 })
    apply(instance, { Status: null })
    expect(instance['Session/Energy']).toBe(4)
    expect(instance['Session/Time']).toBe(100)
  })

  test.each([
    ['auto session off', { evcs_charging_control: true, evcs_auto_session: false }],
    ['charging control off', { evcs_auto_session: true }]
  ])('does nothing with %s', (_, config) => {
    const instance = charging()
    apply(instance, { 'Ac/Power': 7200 }, config)
    now += HOUR
    const result = apply(instance, { 'Ac/Power': 7200 }, config)
    expect(result).toEqual({ 'Ac/Power': 7200 })
  })
})

describe('evcs.sessionTick', () => {
  let now
  beforeEach(() => {
    now = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => jest.restoreAllMocks())

  test('advances session time and energy while charging without other updates', () => {
    const instance = { Status: 2, 'Ac/Power': 3600, 'Session/Energy': 0, 'Session/Time': 0, ChargingTime: 0 }
    evcs.onPropertiesChanged({ changes: { 'Ac/Power': 3600 }, instance, config: CONFIG })
    now += 10 * 1000
    const changes = evcs.sessionTick({ instance, config: CONFIG })
    expect(changes['Session/Time']).toBe(10)
    expect(changes.ChargingTime).toBe(10)
    expect(changes['Session/Energy']).toBeCloseTo(0.01, 5)
  })

  // The node applies tick results through setValuesLocally, which runs onPropertiesChanged again.
  test('applying tick results does not drop fractional seconds', () => {
    const instance = { Status: 2, 'Ac/Power': 0, 'Session/Energy': 0, 'Session/Time': 0, ChargingTime: 0 }
    const applyLocally = (changes) => Object.assign(instance, evcs.onPropertiesChanged({ changes: { ...changes }, instance, config: CONFIG }))
    applyLocally({ 'Ac/Power': 0 })
    now += 10_500
    applyLocally(evcs.sessionTick({ instance, config: CONFIG }))
    now += 10_500
    applyLocally(evcs.sessionTick({ instance, config: CONFIG }))
    expect(instance['Session/Time']).toBe(21)
  })

  test('returns null while not charging', () => {
    const instance = { Status: 1, 'Ac/Power': 0, 'Session/Time': 0 }
    expect(evcs.sessionTick({ instance, config: CONFIG })).toBeNull()
  })

  test('returns null when auto session is off', () => {
    const instance = { Status: 2, 'Ac/Power': 3600, 'Session/Time': 0 }
    expect(evcs.sessionTick({ instance, config: { evcs_charging_control: true } })).toBeNull()
  })

  test('isAutoSession requires charging control', () => {
    expect(evcs.isAutoSession(CONFIG)).toBe(true)
    expect(evcs.isAutoSession({ evcs_auto_session: true })).toBe(false)
  })
})

describe('evcs.startSessionTimer', () => {
  beforeEach(() => jest.useFakeTimers({ now: 1_000_000 }))
  afterEach(() => jest.useRealTimers())

  function makeNode (instance) {
    return {
      error: jest.fn(),
      setValuesLocally: jest.fn((changes) => Object.assign(instance, evcs.onPropertiesChanged({ changes, instance, config: CONFIG })))
    }
  }

  test('writes the session time every 10 s while charging', () => {
    const instance = { Status: 2, 'Ac/Power': 0, 'Session/Energy': 0, 'Session/Time': 0, ChargingTime: 0 }
    const node = makeNode(instance)
    evcs.onPropertiesChanged({ changes: {}, instance, config: CONFIG })
    const stop = evcs.startSessionTimer({ node, instance, config: CONFIG })

    jest.advanceTimersByTime(10_000)
    expect(instance['Session/Time']).toBe(10)
    jest.advanceTimersByTime(10_000)
    expect(instance['Session/Time']).toBe(20)
    stop()
  })

  test('does not write while not charging', () => {
    const instance = { Status: 1, 'Session/Time': 0 }
    const node = makeNode(instance)
    const stop = evcs.startSessionTimer({ node, instance, config: CONFIG })
    jest.advanceTimersByTime(30_000)
    expect(node.setValuesLocally).not.toHaveBeenCalled()
    stop()
  })

  test('stops writing after stop()', () => {
    const instance = { Status: 2, 'Ac/Power': 0, 'Session/Time': 0 }
    const node = makeNode(instance)
    evcs.onPropertiesChanged({ changes: {}, instance, config: CONFIG })
    const stop = evcs.startSessionTimer({ node, instance, config: CONFIG })
    stop()
    jest.advanceTimersByTime(30_000)
    expect(node.setValuesLocally).not.toHaveBeenCalled()
  })

  test('is not started without auto session', () => {
    expect(evcs.startSessionTimer({ node: makeNode({}), instance: {}, config: { evcs_charging_control: true } })).toBeNull()
  })

  test('reports a failed write as a node error', () => {
    const instance = { Status: 2, 'Ac/Power': 0, 'Session/Time': 0 }
    const node = makeNode(instance)
    node.setValuesLocally.mockImplementation(() => { throw new Error('boom') })
    evcs.onPropertiesChanged({ changes: {}, instance, config: CONFIG })
    const stop = evcs.startSessionTimer({ node, instance, config: CONFIG })
    jest.advanceTimersByTime(10_000)
    expect(node.error).toHaveBeenCalledWith(expect.stringContaining('boom'))
    stop()
  })
})
