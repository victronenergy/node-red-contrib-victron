// test/victron-virtual-constants.test.js
const { SWITCH_TYPE_MAP } = require('../src/nodes/victron-virtual-constants')

describe('Virtual Device Constants', () => {
  describe('SWITCH_TYPE_MAP', () => {
    test('exports all required switch types', () => {
      expect(SWITCH_TYPE_MAP).toBeDefined()
      expect(SWITCH_TYPE_MAP.MOMENTARY).toBe(0)
      expect(SWITCH_TYPE_MAP.TOGGLE).toBe(1)
      expect(SWITCH_TYPE_MAP.DIMMABLE).toBe(2)
      expect(SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT).toBe(3)
      expect(SWITCH_TYPE_MAP.STEPPED).toBe(4)
      expect(SWITCH_TYPE_MAP.DROPDOWN).toBe(6)
      expect(SWITCH_TYPE_MAP.BASIC_SLIDER).toBe(7)
      expect(SWITCH_TYPE_MAP.NUMERIC_INPUT).toBe(8)
      expect(SWITCH_TYPE_MAP.THREE_STATE).toBe(9)
      expect(SWITCH_TYPE_MAP.BILGE_PUMP).toBe(10)
    })

    test('has reverse mapping available', () => {
      expect(SWITCH_TYPE_MAP.MOMENTARY).toBe(0)
      expect(Object.keys(SWITCH_TYPE_MAP).length).toBeGreaterThan(0)
    })
  })
})
