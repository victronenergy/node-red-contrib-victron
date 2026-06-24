// test/victron-virtual-ev.test.js
/* eslint-env jest */
const ev = require('../src/nodes/victron-virtual/device-type/ev')

describe('ev device module', () => {
  test('exports required contract', () => {
    expect(typeof ev.properties).toBe('function')
    expect(typeof ev.initialize).toBe('function')
    expect(typeof ev.onPropertiesChanged).toBe('function')
  })

  describe('Mgmt/Connection property type', () => {
    test('is integer when ev_evcs_device_instance is configured', () => {
      expect(ev.properties({ ev_evcs_device_instance: 40 })['Mgmt/Connection']).toEqual({ type: 'i' })
    })

    test('is string defaulting to Node-RED when ev_evcs_device_instance is null', () => {
      expect(ev.properties({ ev_evcs_device_instance: null })['Mgmt/Connection']).toEqual({ type: 's', value: 'Node-RED' })
    })

    test('is string defaulting to Node-RED when ev_evcs_device_instance is absent', () => {
      expect(ev.properties({})['Mgmt/Connection']).toEqual({ type: 's', value: 'Node-RED' })
    })

    test('is string defaulting to Node-RED when ev_evcs_device_instance is empty string', () => {
      expect(ev.properties({ ev_evcs_device_instance: '' })['Mgmt/Connection']).toEqual({ type: 's', value: 'Node-RED' })
    })
  })

  describe('ChargingState format', () => {
    const fmt = ev.properties({}).ChargingState.format

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
    test('always sets LastUpdated/EvContact timestamp', () => {
      const before = Math.floor(Date.now() / 1000)
      const result = ev.onPropertiesChanged({ changes: { Soc: 75 }, instance: {} })
      const after = Math.floor(Date.now() / 1000)
      expect(result['LastUpdated/EvContact']).toBeGreaterThanOrEqual(before)
      expect(result['LastUpdated/EvContact']).toBeLessThanOrEqual(after)
    })

    test('does not override LastUpdated/EvContact when explicitly set by caller', () => {
      const externalContactTime = Math.floor(Date.now() / 1000) - 3600
      const result = ev.onPropertiesChanged({ changes: { 'LastUpdated/EvContact': externalContactTime }, instance: {} })
      expect(result['LastUpdated/EvContact']).toBe(externalContactTime)
    })

    test('sets LastUpdated/Location when position-related fields actually change', () => {
      const positionFields = ['Position/Latitude', 'Position/Longitude', 'AtSite']
      for (const prop of positionFields) {
        const result = ev.onPropertiesChanged({ changes: { [prop]: 1 }, instance: { [prop]: 0 } })
        expect(result).toHaveProperty('LastUpdated/Location')
        expect(typeof result['LastUpdated/Location']).toBe('number')
      }
    })

    test('does set LastUpdated/Location when position field value is unchanged', () => {
      const result = ev.onPropertiesChanged({
        changes: { 'Position/Latitude': 52.5 },
        instance: { 'Position/Latitude': 52.5 }
      })
      expect(result).toHaveProperty('LastUpdated/Location')
    })

    test('does not set LastUpdated/Location for non-position fields', () => {
      const result = ev.onPropertiesChanged({ changes: { Soc: 75 }, instance: {} })
      expect(result).not.toHaveProperty('LastUpdated/Location')
    })

    test('sets LastUpdated/Charging when ChargingState actually changes', () => {
      const before = Math.floor(Date.now() / 1000)
      const result = ev.onPropertiesChanged({
        changes: { ChargingState: 3 },
        instance: { ChargingState: 0 }
      })
      const after = Math.floor(Date.now() / 1000)
      expect(result['LastUpdated/Charging']).toBeGreaterThanOrEqual(before)
      expect(result['LastUpdated/Charging']).toBeLessThanOrEqual(after)
    })

    test('does not set LastUpdated/Charging when ChargingState value is unchanged', () => {
      const result = ev.onPropertiesChanged({
        changes: { ChargingState: 3 },
        instance: { ChargingState: 3 }
      })
      expect(result).not.toHaveProperty('LastUpdated/Charging')
    })

    test('sets LastUpdated/Charging when ChargingState changes to 0', () => {
      const result = ev.onPropertiesChanged({
        changes: { ChargingState: 0 },
        instance: { ChargingState: 3 }
      })
      expect(result).toHaveProperty('LastUpdated/Charging')
    })

    test('does not include msg in result', () => {
      const result = ev.onPropertiesChanged({ changes: { Soc: 50 }, instance: {} })
      expect(result).not.toHaveProperty('msg')
    })

    describe('Mgmt/Connection from AtSite', () => {
      test('sets Mgmt/Connection to EVCS device instance when AtSite becomes 1', () => {
        const result = ev.onPropertiesChanged({
          changes: { AtSite: 1 },
          instance: {},
          config: { ev_evcs_device_instance: 40 }
        })
        expect(result['Mgmt/Connection']).toBe(40)
      })

      test('clears Mgmt/Connection when AtSite becomes 0', () => {
        const result = ev.onPropertiesChanged({
          changes: { AtSite: 0 },
          instance: {},
          config: { ev_evcs_device_instance: 40 }
        })
        expect(result['Mgmt/Connection']).toBeNull()
      })

      test('does not set Mgmt/Connection when no EVCS configured', () => {
        const result = ev.onPropertiesChanged({
          changes: { AtSite: 1 },
          instance: {},
          config: {}
        })
        expect(result).not.toHaveProperty('Mgmt/Connection')
      })

      test('does not set Mgmt/Connection when ev_evcs_device_instance is empty string', () => {
        const result = ev.onPropertiesChanged({
          changes: { AtSite: 1 },
          instance: {},
          config: { ev_evcs_device_instance: '' }
        })
        expect(result).not.toHaveProperty('Mgmt/Connection')
      })

      test('does not set Mgmt/Connection when AtSite not in changes', () => {
        const result = ev.onPropertiesChanged({
          changes: { Soc: 80 },
          instance: {},
          config: { ev_evcs_device_instance: 40 }
        })
        expect(result).not.toHaveProperty('Mgmt/Connection')
      })

      test('does not set Mgmt/Connection when config is absent', () => {
        const result = ev.onPropertiesChanged({ changes: { AtSite: 1 }, instance: {} })
        expect(result).not.toHaveProperty('Mgmt/Connection')
      })
    })
  })
})
