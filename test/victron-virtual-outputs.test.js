// test/victron-virtual-outputs.test.js
const { calculateOutputs } = require('./fixtures/victron-virtual-functions.cjs')
const { SWITCH_TYPE_MAP, SWITCH_OUTPUT_CONFIG } = require('../src/nodes/victron-virtual-constants')

describe('calculateOutputs', () => {
  describe('non-switch devices', () => {
    test('battery has 1 output (passthrough only)', () => {
      expect(calculateOutputs('battery', {})).toBe(1)
    })

    test('gps has 1 output (passthrough only)', () => {
      expect(calculateOutputs('gps', {})).toBe(1)
    })

    test('meteo has 1 output (passthrough only)', () => {
      expect(calculateOutputs('meteo', {})).toBe(1)
    })

    test('unknown device defaults to 1 output', () => {
      expect(calculateOutputs('unknown-device', {})).toBe(1)
    })

    test('undefined device defaults to 1 output', () => {
      expect(calculateOutputs(undefined, {})).toBe(1)
    })
  })

  describe('switch devices', () => {
    test('momentary switch has 2 outputs (passthrough + state)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.MOMENTARY) }
      expect(calculateOutputs('switch', config)).toBe(2)
    })

    test('toggle switch has 2 outputs (passthrough + state)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.TOGGLE) }
      expect(calculateOutputs('switch', config)).toBe(2)
    })

    test('dimmable switch has 3 outputs (passthrough + state + value)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.DIMMABLE) }
      expect(calculateOutputs('switch', config)).toBe(3)
    })

    test('temperature setpoint switch has 3 outputs (passthrough + state + value)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT) }
      expect(calculateOutputs('switch', config)).toBe(3)
    })

    test('stepped switch has 3 outputs (passthrough + state + value)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.STEPPED) }
      expect(calculateOutputs('switch', config)).toBe(3)
    })

    test('dropdown switch has 2 outputs (passthrough + state)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.DROPDOWN) }
      expect(calculateOutputs('switch', config)).toBe(2)
    })

    test('basic slider switch has 3 outputs (passthrough + state + value)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.BASIC_SLIDER) }
      expect(calculateOutputs('switch', config)).toBe(3)
    })

    test('numeric input switch has 3 outputs (passthrough + state + value)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.NUMERIC_INPUT) }
      expect(calculateOutputs('switch', config)).toBe(3)
    })

    test('three-state switch has 2 outputs (passthrough + state)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE) }
      expect(calculateOutputs('switch', config)).toBe(2)
    })

    test('bilge pump switch has 2 outputs (passthrough + state)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.BILGE_PUMP) }
      expect(calculateOutputs('switch', config)).toBe(2)
    })

    test('switch without type config defaults to toggle (2 outputs)', () => {
      expect(calculateOutputs('switch', {})).toBe(2)
    })

    test('switch with undefined type defaults to toggle (2 outputs)', () => {
      const config = { switch_1_type: undefined }
      expect(calculateOutputs('switch', config)).toBe(2)
    })

    test('switch with invalid type defaults to toggle (2 outputs)', () => {
      const config = { switch_1_type: 'invalid' }
      expect(calculateOutputs('switch', config)).toBe(2)
    })

    test('switch with numeric type (not string)', () => {
      const config = { switch_1_type: SWITCH_TYPE_MAP.DIMMABLE }
      expect(calculateOutputs('switch', config)).toBe(3)
    })
  })

  describe('edge cases', () => {
    test('handles null config', () => {
      expect(calculateOutputs('battery', null)).toBe(1)
    })

    test('handles undefined config', () => {
      expect(calculateOutputs('switch', undefined)).toBe(2)
    })

    test('handles empty string device', () => {
      expect(calculateOutputs('', {})).toBe(1)
    })
  })

  describe('validates against SWITCH_OUTPUT_CONFIG', () => {
    test('all switch types in SWITCH_OUTPUT_CONFIG are covered', () => {
      Object.keys(SWITCH_OUTPUT_CONFIG).forEach(typeKey => {
        const config = { switch_1_type: typeKey }
        const outputs = calculateOutputs('switch', config)
        expect(outputs).toBe(SWITCH_OUTPUT_CONFIG[typeKey])
      })
    })
  })
})
