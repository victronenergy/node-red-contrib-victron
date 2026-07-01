// test/energy-utils.test.js
/* eslint-env jest */
const { accumulateDelta } = require('../src/nodes/victron-virtual/energy-utils')

describe('accumulateDelta', () => {
  test('accumulates energy for a given power over time', () => {
    const changes = {}
    const instance = { 'Ac/Energy/Forward': 0 }
    accumulateDelta({
      changes,
      instance,
      energyKey: 'Ac/Energy/Forward',
      oldPower: 1000,
      lastTs: Date.now() - 3_600_000,
      now: Date.now()
    })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(1.0, 2)
  })

  test('adds delta to existing accumulated energy', () => {
    const changes = {}
    const instance = { 'Ac/Energy/Forward': 5.0 }
    accumulateDelta({
      changes,
      instance,
      energyKey: 'Ac/Energy/Forward',
      oldPower: 2000,
      lastTs: Date.now() - 1_800_000,
      now: Date.now()
    })
    expect(changes['Ac/Energy/Forward']).toBeCloseTo(6.0, 2)
  })

  test('skips when lastTs is null', () => {
    const changes = {}
    const instance = { 'Ac/Energy/Forward': 0 }
    accumulateDelta({
      changes,
      instance,
      energyKey: 'Ac/Energy/Forward',
      oldPower: 1000,
      lastTs: null,
      now: Date.now()
    })
    expect(changes['Ac/Energy/Forward']).toBeUndefined()
  })

  test('skips when oldPower is null', () => {
    const changes = {}
    const instance = { 'Ac/Energy/Forward': 0 }
    accumulateDelta({
      changes,
      instance,
      energyKey: 'Ac/Energy/Forward',
      oldPower: null,
      lastTs: Date.now() - 3_600_000,
      now: Date.now()
    })
    expect(changes['Ac/Energy/Forward']).toBeUndefined()
  })

  test('does not write to changes when power is zero', () => {
    const changes = {}
    const instance = { 'Ac/Energy/Forward': 2.0 }
    accumulateDelta({
      changes,
      instance,
      energyKey: 'Ac/Energy/Forward',
      oldPower: 0,
      lastTs: Date.now() - 3_600_000,
      now: Date.now()
    })
    expect(changes['Ac/Energy/Forward']).toBeUndefined()
  })

  test('clamps negative power to zero', () => {
    const changes = {}
    const instance = { 'Ac/Energy/Forward': 2.0 }
    accumulateDelta({
      changes,
      instance,
      energyKey: 'Ac/Energy/Forward',
      oldPower: -100,
      lastTs: Date.now() - 3_600_000,
      now: Date.now()
    })
    expect(changes['Ac/Energy/Forward']).toBeUndefined()
  })

  test('does not overwrite energyKey already present in changes', () => {
    const changes = { 'Ac/Energy/Forward': 99 }
    const instance = { 'Ac/Energy/Forward': 0 }
    accumulateDelta({
      changes,
      instance,
      energyKey: 'Ac/Energy/Forward',
      oldPower: 1000,
      lastTs: Date.now() - 3_600_000,
      now: Date.now()
    })
    expect(changes['Ac/Energy/Forward']).toBe(99)
  })
})
