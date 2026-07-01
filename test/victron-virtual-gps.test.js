// test/victron-virtual-gps.test.js
/* eslint-env jest */
const gps = require('../src/nodes/victron-virtual/device-type/gps')

describe('gps device module', () => {
  describe('UtcTime property', () => {
    test('type is u (uint32), not s (string)', () => {
      expect(gps.properties.UtcTime.type).toBe('u')
    })
  })

  describe('UtcTime format', () => {
    const fmt = gps.properties.UtcTime.format

    test('null returns empty string', () => {
      expect(fmt(null)).toBe('')
    })

    test.each([
      [0, '00:00:00 UTC'],
      [3600000, '01:00:00 UTC'],
      [43200000, '12:00:00 UTC'],
      [86399000, '23:59:59 UTC']
    ])('%i ms formats to "%s"', (value, expected) => {
      expect(fmt(value)).toBe(expected)
    })
  })

  describe('onPropertiesChanged', () => {
    const GPS_DATA_FIELDS = ['Position/Latitude', 'Position/Longitude', 'Speed', 'Course', 'Altitude', 'Fix', 'NrOfSatellites']

    test.each(GPS_DATA_FIELDS)('auto-injects UtcTime when %s changes', (field) => {
      const before = Date.now() % 86400000
      const result = gps.onPropertiesChanged({ changes: { [field]: 1 }, instance: {} })
      const after = Date.now() % 86400000
      expect(result.UtcTime).toBeGreaterThanOrEqual(before)
      expect(result.UtcTime).toBeLessThanOrEqual(after)
    })

    test('does not override UtcTime when explicitly provided', () => {
      const explicit = 43200000
      const result = gps.onPropertiesChanged({
        changes: { 'Position/Latitude': 52.5, UtcTime: explicit },
        instance: {}
      })
      expect(result.UtcTime).toBe(explicit)
    })

    test('does not inject UtcTime when no GPS data fields are in changes', () => {
      const result = gps.onPropertiesChanged({ changes: { Connected: 1 }, instance: {} })
      expect(result).not.toHaveProperty('UtcTime')
    })

    test('injected UtcTime is within a valid day range', () => {
      const result = gps.onPropertiesChanged({ changes: { Speed: 5 }, instance: {} })
      expect(result.UtcTime).toBeGreaterThanOrEqual(0)
      expect(result.UtcTime).toBeLessThan(86400000)
    })
  })
})
