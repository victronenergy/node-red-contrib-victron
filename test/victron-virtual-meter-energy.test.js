/* eslint-env jest */
const { accumulateMeterEnergy, setMeterPresence } = require('../src/nodes/victron-virtual/device-type/shared/meter-energy')

const HOUR = 3600 * 1000

// Applies an update the way setValuesLocally does: calculate, then store the result
function createMeter (phases, initial = {}) {
  const instance = { ...initial }
  return {
    instance,
    update (hours, values) {
      const changes = { ...values }
      accumulateMeterEnergy({ changes, instance, phases, now: hours * HOUR })
      Object.assign(instance, changes)
      return changes
    }
  }
}

describe('accumulateMeterEnergy', () => {
  test('adds no energy on the first power reading', () => {
    const meter = createMeter([1])
    const changes = meter.update(0, { 'Ac/L1/Power': 500 })
    expect(changes['Ac/L1/Energy/Forward']).toBeUndefined()
    expect(changes['Ac/Energy/Forward']).toBeUndefined()
  })

  test('integrates the previous phase power over the elapsed time', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/L1/Power': 500 })
    const changes = meter.update(1, { 'Ac/L1/Power': 800 })
    expect(changes['Ac/L1/Energy/Forward']).toBeCloseTo(0.5, 5)
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(0.5, 5)
  })

  test('counts every phase, also when the phases arrive in separate messages', () => {
    const meter = createMeter([1, 2, 3])
    meter.update(0, { 'Ac/L1/Power': 1000, 'Ac/L2/Power': 1000, 'Ac/L3/Power': 1000 })
    meter.update(1, { 'Ac/L1/Power': 1000 })
    meter.update(2, { 'Ac/L2/Power': 1000 })
    expect(meter.instance['Ac/L1/Energy/Forward']).toBeCloseTo(2, 5)
    expect(meter.instance['Ac/L2/Energy/Forward']).toBeCloseTo(2, 5)
    expect(meter.instance['Ac/L3/Energy/Forward']).toBeCloseTo(2, 5)
    expect(meter.instance['Ac/Energy/Forward']).toBeCloseTo(6, 5)
  })

  test('only touches the given phases', () => {
    const meter = createMeter([3])
    meter.update(0, { 'Ac/L1/Power': 500, 'Ac/L3/Power': 500 })
    const changes = meter.update(1, { 'Ac/L1/Power': 500, 'Ac/L3/Power': 500 })
    expect(changes['Ac/L3/Energy/Forward']).toBeCloseTo(0.5, 5)
    expect(changes['Ac/L1/Energy/Forward']).toBeUndefined()
  })

  test.each([
    ['1000 W', 1000, 1],
    ['no power', null, undefined],
    ['zero power', 0, undefined],
    ['negative power, counted as 0', -100, undefined]
  ])('integrates %s over an hour', (_, power, total) => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/Power': power })
    const changes = meter.update(1, { 'Ac/Power': power })
    if (total === undefined) expect(changes['Ac/Energy/Forward']).toBeUndefined()
    else expect(changes['Ac/Energy/Forward']).toBeCloseTo(total, 5)
  })

  test('integrates Ac/Power when the flow reports no phase power', () => {
    const meter = createMeter([1], { 'Ac/Energy/Forward': 2 })
    meter.update(0, { 'Ac/Power': 1000 })
    const changes = meter.update(1, { 'Ac/Power': 1000 })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(3, 5)
  })

  test('does not count Ac/Power on top of the phase powers in the same message', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/Power': 9999, 'Ac/L1/Power': 1000 })
    const changes = meter.update(1, { 'Ac/Power': 9999, 'Ac/L1/Power': 1000 })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(1, 5)
  })

  // Review on #616: the total was replaced by the sum of phase counters that were never used
  test('keeps the total accumulated from Ac/Power when the flow switches to phase powers', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/Power': 1000 })
    meter.update(5, { 'Ac/Power': 1000 })
    meter.update(6, { 'Ac/L1/Power': 1000 })
    const changes = meter.update(7, { 'Ac/L1/Power': 1000 })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(7, 5)
  })

  // Review on #616: an interval was counted by the phases and again by Ac/Power
  test('counts each interval once when phase and total power updates alternate', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/Power': 1000, 'Ac/L1/Power': 1000 })
    meter.update(1, { 'Ac/L1/Power': 1000 })
    const changes = meter.update(2, { 'Ac/Power': 1000 })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(2, 5)
  })

  test('a total or phase energy from the flow wins over the calculated one', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/L1/Power': 1000 })
    const changes = meter.update(1, { 'Ac/L1/Power': 1000, 'Ac/L1/Energy/Forward': 5, 'Ac/Energy/Forward': 99 })
    expect(changes['Ac/L1/Energy/Forward']).toBe(5)
    expect(changes['Ac/Energy/Forward']).toBe(99)
  })

  test.each([
    ['on its own', { 'Ac/L1/Energy/Forward': 1 }],
    ['with Ac/Power', { 'Ac/Power': 1000, 'Ac/L1/Energy/Forward': 1 }]
  ])('does not add a phase counter the flow reports %s to the total counted from Ac/Power', (_, values) => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/Power': 1000 })
    meter.update(1, { 'Ac/Power': 1000 })
    meter.update(1.5, values)
    meter.update(2, { 'Ac/Power': 1000 })
    expect(meter.instance['Ac/Energy/Forward']).toBeCloseTo(2, 5)
  })

  test('keeps the total when a phase counter from the flow is lower than the calculated one', () => {
    const meter = createMeter([1, 2])
    const powers = { 'Ac/L1/Power': 1000, 'Ac/L2/Power': 1000 }
    meter.update(0, powers)
    meter.update(1, powers)
    const changes = meter.update(1.5, { ...powers, 'Ac/L1/Energy/Forward': 0.5 })
    expect(changes['Ac/L1/Energy/Forward']).toBe(0.5)
    // Only L2's half hour: the lower L1 counter takes nothing off
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(2.5, 5)
  })

  test('keeps a total the flow set when phase powers follow', () => {
    const meter = createMeter([1], { 'Ac/Energy/Forward': 50, 'Ac/L1/Energy/Forward': 0 })
    meter.update(0, { 'Ac/L1/Power': 1000 })
    meter.update(1, { 'Ac/L1/Power': 1000 })
    expect(meter.instance['Ac/Energy/Forward']).toBeCloseTo(51, 5)
  })

  test('grows the total by a phase counter the flow reports with the phase power', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/L1/Power': 1000, 'Ac/L1/Energy/Forward': 12345 })
    meter.update(1, { 'Ac/L1/Power': 1000, 'Ac/L1/Energy/Forward': 12346 })
    expect(meter.instance['Ac/Energy/Forward']).toBeCloseTo(12346, 5)
  })

  // Offline from 1 h to 10 h: the hours 0-1 and 10-11 count, 2 kWh
  test.each([
    ['power updates while offline', [2, 9]],
    ['no power updates while offline (power sent only on change)', []]
  ])('counts only the time online, with %s', (_, offlineUpdates) => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/L1/Power': 1000 })
    setMeterPresence(meter.instance, false, 1 * HOUR)
    offlineUpdates.forEach(hours => meter.update(hours, { 'Ac/L1/Power': 1000 }))
    setMeterPresence(meter.instance, true, 10 * HOUR)
    meter.update(11, { 'Ac/L1/Power': 1000 })
    expect(meter.instance['Ac/Energy/Forward']).toBeCloseTo(2, 5)
  })

  // The counter's hour is counted by the source that started it: Ac/Power or the phase power
  test.each([
    ['from Ac/Power to phase powers', [{ 'Ac/Power': 1000 }, { 'Ac/Power': 1000 }, { 'Ac/L1/Power': 1000, 'Ac/Power': 1000 }]],
    ['from phase powers to Ac/Power', [{ 'Ac/L1/Power': 1000, 'Ac/Power': 1000 }, { 'Ac/Power': 1000 }, { 'Ac/Power': 1000 }]]
  ])('counts each hour once when a flow with its own phase counter switches %s', (_, powers) => {
    const meter = createMeter([1], { 'Ac/Energy/Forward': 50, 'Ac/L1/Energy/Forward': 10 })
    powers.forEach((values, hour) => meter.update(hour, { ...values, 'Ac/L1/Energy/Forward': 10 + hour }))
    expect(meter.instance['Ac/Energy/Forward']).toBeCloseTo(52, 5)
  })

  test('ignores messages without power', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/L1/Power': 1000 })
    meter.update(1, { 'Ac/L1/Voltage': 230 })
    const changes = meter.update(2, { 'Ac/L1/Power': 1000 })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(2, 5)
  })
})
