// test/victron-virtual-pulsemeter.test.js
/* eslint-env jest */
const pulsemeter = require('../src/nodes/victron-virtual/device-type/pulsemeter')

describe('pulsemeter device module', () => {
  test('exports required contract', () => {
    expect(typeof pulsemeter.properties).toBe('object')
    expect(typeof pulsemeter.initialize).toBe('function')
    expect(typeof pulsemeter.onPropertiesChanged).toBe('function')
    expect(pulsemeter.initialize()).toBe('Virtual pulse meter')
  })

  describe('properties definition', () => {
    test('defines Count property format', () => {
      const countProp = pulsemeter.properties.Count
      expect(countProp).toBeDefined()
      expect(typeof countProp.format).toBe('function')
      expect(countProp.format(123)).toBe('123')
      expect(countProp.format(null)).toBe('')
    })
    test('defines Aggregate property format', () => {
      const aggProp = pulsemeter.properties.Aggregate
      expect(aggProp).toBeDefined()
      expect(typeof aggProp.format).toBe('function')
      expect(aggProp.format(1.234567)).toBe('1.235m³')
      expect(aggProp.format(null)).toBe('')
    })
  })

  describe('onPropertyChanged - dumb mode', () => {
    test('does not modify Aggregate when auto_aggregate is false', () => {
      const changes = pulsemeter.onPropertiesChanged({
        changes: { Count: 500 },
        instance: {},
        config: { auto_aggregate: false, pulsemeter_multiplier: 0.001 }
      })
      expect(changes.Count).toEqual(500)
      expect(changes.Aggregate).toBeUndefined()
    })

    test('does not react to non-Count property changes', () => {
      const changes = pulsemeter.onPropertiesChanged({
        changes: { Aggregate: 500 },
        instance: {},
        config: { auto_aggregate: false, pulsemeter_multiplier: 0.001 }
      })
      // Aggregate changes always produce output (not setValues)
      expect(changes.Aggregate).toEqual(500)
      expect(Object.keys(changes)).toEqual(['Aggregate'])
    })
  })

  describe('onPropertyChanged - smart mode', () => {
    test('computes Aggregate from Count x multiplier', () => {
      const changes = pulsemeter.onPropertiesChanged({
        changes: { Count: 1000 },
        instance: {},
        config: { auto_aggregate: true, pulsemeter_multiplier: 0.001 }
      })
      expect(changes.Count).toEqual(1000)
      expect(changes.Aggregate).toBeCloseTo(1.0)
    })

    test('does not compute if Count is null', () => {
      const changes = pulsemeter.onPropertiesChanged({
        changes: { Count: null },
        instance: {},
        config: { auto_aggregate: true, pulsemeter_multiplier: 0.001 }
      })
      expect(changes.Count).toBeNull()
      expect(changes.Aggregate).toBeUndefined()
    })

    test('does not compute if multiplier is zero', () => {
      const changes = pulsemeter.onPropertiesChanged({
        changes: { Count: 100 },
        instance: {},
        config: { auto_aggregate: true, pulsemeter_multiplier: 0 }
      })
      expect(changes.Count).toEqual(100)
      expect(changes.Aggregate).toBeUndefined()
    })

    test('does not compute if multiplier is invalid', () => {
      const changes = pulsemeter.onPropertiesChanged({
        changes: { Count: 100 },
        instance: {},
        config: { auto_aggregate: true, pulsemeter_multiplier: 'bad' }
      })
      expect(changes.Count).toEqual(100)
      expect(changes.Aggregate).toBeUndefined()
    })
  })
})
