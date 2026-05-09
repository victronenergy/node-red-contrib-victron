// test/victron-virtual-ev.test.js
/* eslint-env jest */
const ev = require('../src/nodes/victron-virtual/device-type/ev')

describe('ev device module', () => {
  test('exports required contract', () => {
    expect(typeof ev.properties).toBe('object')
    expect(typeof ev.initialize).toBe('function')
    expect(typeof ev.onPropertiesChanged).toBe('function')
  })

  describe('ChargingState format', () => {
    const fmt = ev.properties.ChargingState.format

    test.each([
      [0, 'Not charging'],
      [1, 'Low power mode'],
      [3, 'Charging'],
      [244, 'Sustain'],
      [245, 'Wake up'],
      [250, 'Blocked'],
      [255, 'Unavailable'],
      [256, 'Discharging'],
      [259, 'Scheduled charging']
    ])('value %i formats to "%s"', (value, expected) => {
      expect(fmt(value)).toBe(expected)
    })

    test('unknown value returns "unknown"', () => {
      expect(fmt(2)).toBe('unknown')
      expect(fmt(99)).toBe('unknown')
    })

    test('null returns "unknown"', () => {
      expect(fmt(null)).toBe('unknown')
    })
  })

  describe('onPropertiesChanged', () => {
    test('returns changes with LastEvContact timestamp when a property changes', () => {
      const before = Math.floor(Date.now() / 1000)
      const result = ev.onPropertiesChanged({ changes: { Soc: 75 } })
      const after = Math.floor(Date.now() / 1000)
      expect(result).toHaveProperty('LastEvContact')
      expect(result.LastEvContact).toBeGreaterThanOrEqual(before)
      expect(result.LastEvContact).toBeLessThanOrEqual(after)
    })

    test('does not override LastEvContact when explicitly set by caller', () => {
      const externalContactTime = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      const result = ev.onPropertiesChanged({ changes: { LastEvContact: externalContactTime } })
      expect(result.LastEvContact).toBe(externalContactTime)
    })

    test('updates LastEvContact for any non-LastEvContact property', () => {
      const props = ['Soc', 'TargetSoc', 'ChargingState', 'Ac/Power', 'BatteryCapacity', 'AtSite', 'Connected']
      for (const prop of props) {
        const result = ev.onPropertiesChanged({ changes: { [prop]: 1 } })
        expect(result).toHaveProperty('LastEvContact')
        expect(typeof result.LastEvContact).toBe('number')
      }
    })

    test('does not include msg in result', () => {
      const result = ev.onPropertiesChanged({ changes: { Soc: 50 } })
      expect(result).not.toHaveProperty('msg')
    })
  })
})
