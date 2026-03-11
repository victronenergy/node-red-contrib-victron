// test/victron-virtual-pulsemeter.test.js
/* eslint-env jest */
const pulsemeter = require('../src/nodes/victron-virtual/device-type/pulsemeter')

describe('pulsemeter device module', () => {
  test('exports required contract', () => {
    expect(typeof pulsemeter.properties).toBe('object')
    expect(typeof pulsemeter.initialize).toBe('function')
    expect(typeof pulsemeter.onPropertyChanged).toBe('function')
  })

  describe('onPropertyChanged - dumb mode', () => {
    test('does not return setValues when auto_aggregate is false', () => {
      const result = pulsemeter.onPropertyChanged('Count', 500, {}, { auto_aggregate: false, pulsemeter_multiplier: 0.001 })
      expect(result).toBeUndefined()
    })

    test('does not react to non-Count property changes', () => {
      const result = pulsemeter.onPropertyChanged('Aggregate', 1.0, {}, { auto_aggregate: true, pulsemeter_multiplier: 0.001 })
      // Aggregate changes always produce output (not setValues)
      expect(result).not.toHaveProperty('setValues')
    })
  })

  describe('onPropertyChanged - smart mode', () => {
    test('computes Aggregate from Count x multiplier', () => {
      const result = pulsemeter.onPropertyChanged('Count', 1000, {}, { auto_aggregate: true, pulsemeter_multiplier: 0.001 })
      expect(result.setValues.Aggregate).toBeCloseTo(1.0)
    })

    test('returns output message with computed Aggregate', () => {
      const result = pulsemeter.onPropertyChanged('Count', 1000, {}, { auto_aggregate: true, pulsemeter_multiplier: 0.001 })
      expect(result.outputIndex).toBe(1)
      expect(result.msg.payload).toBeCloseTo(1.0)
      expect(result.msg.topic).toBe('/Aggregate')
    })

    test('does not compute if Count is null', () => {
      const result = pulsemeter.onPropertyChanged('Count', null, {}, { auto_aggregate: true, pulsemeter_multiplier: 0.001 })
      expect(result).toBeUndefined()
    })

    test('does not compute if multiplier is zero', () => {
      const result = pulsemeter.onPropertyChanged('Count', 100, {}, { auto_aggregate: true, pulsemeter_multiplier: 0 })
      expect(result).toBeUndefined()
    })

    test('does not compute if multiplier is invalid', () => {
      const result = pulsemeter.onPropertyChanged('Count', 100, {}, { auto_aggregate: true, pulsemeter_multiplier: 'bad' })
      expect(result).toBeUndefined()
    })
  })

  describe('onPropertyChanged - output message', () => {
    test('returns output message when Aggregate changes', () => {
      const result = pulsemeter.onPropertyChanged('Aggregate', 1.5, {}, { auto_aggregate: false })
      expect(result).toEqual({
        outputIndex: 1,
        msg: { payload: 1.5, topic: '/Aggregate', source_path: '/Aggregate' }
      })
    })

    test('returns undefined for Count changes in dumb mode (no direct output)', () => {
      const result = pulsemeter.onPropertyChanged('Count', 1000, {}, { auto_aggregate: false })
      expect(result).toBeUndefined()
    })

    test('does not return output message when Aggregate is null', () => {
      const result = pulsemeter.onPropertyChanged('Aggregate', null, {}, { auto_aggregate: false })
      expect(result).toBeUndefined()
    })
  })
})
