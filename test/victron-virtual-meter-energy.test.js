/* eslint-env jest */
const { accumulateMeterEnergy } = require('../src/nodes/victron-virtual/device-type/shared/meter-energy')

const HOUR = 3600 * 1000

describe('accumulateMeterEnergy', () => {
  const now = 10 * HOUR

  test('sets the timestamp on the first power reading without adding energy', () => {
    const instance = { 'Ac/L1/Power': 500 }
    const changes = { 'Ac/L1/Power': 500 }
    accumulateMeterEnergy({ changes, instance, phases: [1], now })
    expect(changes['Ac/L1/Energy/Forward']).toBeUndefined()
    expect(instance._lastL1PowerTimestamp).toBe(now)
  })

  test('integrates the previous phase power over the elapsed time', () => {
    const instance = { 'Ac/L1/Power': 500, 'Ac/L1/Energy/Forward': 0, _lastL1PowerTimestamp: now - HOUR }
    const changes = { 'Ac/L1/Power': 800 }
    accumulateMeterEnergy({ changes, instance, phases: [1], now })
    expect(changes['Ac/L1/Energy/Forward']).toBeCloseTo(0.5, 5)
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(0.5, 5)
  })

  test('sets the total as the sum of all phases, including phases not in this update', () => {
    const instance = {
      'Ac/L1/Power': 300,
      'Ac/L1/Energy/Forward': 1.0,
      'Ac/L2/Energy/Forward': 2.0,
      'Ac/L3/Energy/Forward': 3.0,
      _lastL1PowerTimestamp: now - HOUR
    }
    const changes = { 'Ac/L1/Power': 300 }
    accumulateMeterEnergy({ changes, instance, phases: [1, 2, 3], now })
    expect(changes['Ac/L1/Energy/Forward']).toBeCloseTo(1.3, 5)
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(6.3, 5)
  })

  test('only touches the given phases', () => {
    const instance = { 'Ac/L1/Power': 500, 'Ac/L3/Power': 500, _lastL1PowerTimestamp: now - HOUR, _lastL3PowerTimestamp: now - HOUR }
    const changes = { 'Ac/L1/Power': 500, 'Ac/L3/Power': 500 }
    accumulateMeterEnergy({ changes, instance, phases: [3], now })
    expect(changes['Ac/L3/Energy/Forward']).toBeCloseTo(0.5, 5)
    expect(changes['Ac/L1/Energy/Forward']).toBeUndefined()
  })

  test('falls back to Ac/Power when no phase power is in the update', () => {
    const instance = { 'Ac/Power': 1000, 'Ac/Energy/Forward': 2, _lastPowerTimestamp: now - HOUR }
    const changes = { 'Ac/Power': 1000 }
    accumulateMeterEnergy({ changes, instance, phases: [1], now })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(3, 5)
  })

  test('does not count Ac/Power on top of the phase powers', () => {
    const instance = {
      'Ac/Power': 1000,
      'Ac/L1/Power': 1000,
      'Ac/Energy/Forward': 0,
      'Ac/L1/Energy/Forward': 0,
      _lastPowerTimestamp: now - HOUR,
      _lastL1PowerTimestamp: now - HOUR
    }
    const changes = { 'Ac/Power': 1000, 'Ac/L1/Power': 1000 }
    accumulateMeterEnergy({ changes, instance, phases: [1], now })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(1.0, 5)
  })

  test('keeps the Ac/Power timestamp current while phase powers drive the total', () => {
    const instance = { 'Ac/Power': 500, 'Ac/L1/Power': 500, _lastPowerTimestamp: now - 10 * HOUR, _lastL1PowerTimestamp: now - HOUR }
    accumulateMeterEnergy({ changes: { 'Ac/Power': 500, 'Ac/L1/Power': 500 }, instance, phases: [1], now })
    expect(instance._lastPowerTimestamp).toBe(now)
  })

  test('a total or phase energy from the flow wins over the calculated one', () => {
    const instance = { 'Ac/L1/Power': 1000, 'Ac/L1/Energy/Forward': 0, _lastL1PowerTimestamp: now - HOUR }
    const changes = { 'Ac/L1/Power': 1000, 'Ac/L1/Energy/Forward': 5, 'Ac/Energy/Forward': 99 }
    accumulateMeterEnergy({ changes, instance, phases: [1], now })
    expect(changes['Ac/L1/Energy/Forward']).toBe(5)
    expect(changes['Ac/Energy/Forward']).toBe(99)
  })
})
