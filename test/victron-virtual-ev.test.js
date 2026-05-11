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
    test('always sets LastUpdated/ProviderContact timestamp', () => {
      const before = Math.floor(Date.now() / 1000)
      const result = ev.onPropertiesChanged({ changes: { Soc: 75 } })
      const after = Math.floor(Date.now() / 1000)
      expect(result['LastUpdated/ProviderContact']).toBeGreaterThanOrEqual(before)
      expect(result['LastUpdated/ProviderContact']).toBeLessThanOrEqual(after)
    })

    test('does not override LastUpdated/ProviderContact when explicitly set by caller', () => {
      const externalContactTime = Math.floor(Date.now() / 1000) - 3600
      const result = ev.onPropertiesChanged({ changes: { 'LastUpdated/ProviderContact': externalContactTime } })
      expect(result['LastUpdated/ProviderContact']).toBe(externalContactTime)
    })

    test('sets LastUpdated/ChargingStarted when ChargingState changes', () => {
      const result = ev.onPropertiesChanged({ changes: { ChargingState: 3 } })
      expect(result).toHaveProperty('LastUpdated/ChargingStarted')
      expect(typeof result['LastUpdated/ChargingStarted']).toBe('number')
    })

    test('does not set LastUpdated/ChargingStarted for non-ChargingState fields', () => {
      const fields = ['Soc', 'RangeToGo', 'Odometer', 'Ac/Power']
      for (const prop of fields) {
        const result = ev.onPropertiesChanged({ changes: { [prop]: 1 } })
        expect(result).not.toHaveProperty('LastUpdated/ChargingStarted')
      }
    })

    test('sets LastUpdated/Position when position-related fields change', () => {
      const positionFields = ['Position/Latitude', 'Position/Longitude', 'AtSite']
      for (const prop of positionFields) {
        const result = ev.onPropertiesChanged({ changes: { [prop]: 1 } })
        expect(result).toHaveProperty('LastUpdated/Position')
        expect(typeof result['LastUpdated/Position']).toBe('number')
      }
    })

    test('does not set LastUpdated/Position for non-position fields', () => {
      const result = ev.onPropertiesChanged({ changes: { Soc: 75 } })
      expect(result).not.toHaveProperty('LastUpdated/Position')
    })

    test('does not include msg in result', () => {
      const result = ev.onPropertiesChanged({ changes: { Soc: 50 } })
      expect(result).not.toHaveProperty('msg')
    })
  })
})
