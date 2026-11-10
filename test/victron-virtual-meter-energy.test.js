/* eslint-env jest */
const { accumulateMeterEnergy } = require('../src/nodes/victron-virtual/device-type/shared/meter-energy')

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

  test('integrates Ac/Power when the flow reports no phase power', () => {
    const meter = createMeter([1], { 'Ac/Energy/Forward': 2 })
    meter.update(0, { 'Ac/Power': 1000 })
    const changes = meter.update(1, { 'Ac/Power': 1000 })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(3, 5)
  })

  test('does not count Ac/Power on top of the phase powers in the same message', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/Power': 1000, 'Ac/L1/Power': 1000 })
    const changes = meter.update(1, { 'Ac/Power': 1000, 'Ac/L1/Power': 1000 })
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

  test('ignores messages without power', () => {
    const meter = createMeter([1])
    meter.update(0, { 'Ac/L1/Power': 1000 })
    meter.update(1, { 'Ac/L1/Voltage': 230 })
    const changes = meter.update(2, { 'Ac/L1/Power': 1000 })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(2, 5)
  })
})
