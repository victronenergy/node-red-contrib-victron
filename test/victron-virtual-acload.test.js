// test/victron-virtual-acload.test.js
/* eslint-env jest */
const acload = require('../src/nodes/victron-virtual/device-type/acload')

describe('acload device module', () => {
  test('exports required contract', () => {
    expect(typeof acload.properties).toBe('object')
    expect(typeof acload.initialize).toBe('function')
    expect(typeof acload.onPropertiesChanged).toBe('function')
  })

  describe('onPropertiesChanged - auto_energy disabled', () => {
    test('returns changes unmodified when acload_auto_energy is false', () => {
      const instance = { 'Ac/Power': 500 }
      const changes = { 'Ac/Power': 600 }
      const result = acload.onPropertiesChanged({
        changes,
        instance,
        config: { acload_auto_energy: false, acload_nrofphases: 1 }
      })
      expect(result['Ac/Energy/Forward']).toBeUndefined()
      expect(result['Ac/Power']).toBe(600)
    })

    test('does not set timestamp on instance when disabled', () => {
      const instance = { 'Ac/Power': 500 }
      acload.onPropertiesChanged({
        changes: { 'Ac/Power': 600 },
        instance,
        config: { acload_auto_energy: false, acload_nrofphases: 1 }
      })
      expect(instance._lastPowerTimestamp).toBeUndefined()
    })

    test('treats undefined acload_auto_energy as disabled (migration from older flows)', () => {
      const instance = { 'Ac/Power': 1000, 'Ac/Energy/Forward': 0 }
      instance._lastPowerTimestamp = Date.now() - 3_600_000
      const result = acload.onPropertiesChanged({
        changes: { 'Ac/Power': 1000 },
        instance,
        config: { acload_nrofphases: 1 }
      })
      expect(result['Ac/Energy/Forward']).toBeUndefined()
    })
  })

  describe('onPropertiesChanged - auto_energy enabled', () => {
    test('sets timestamp on first power reading, does not inject energy', () => {
      const instance = { 'Ac/Power': null }
      const before = Date.now()
      acload.onPropertiesChanged({
        changes: { 'Ac/Power': 1000 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      expect(instance._lastPowerTimestamp).toBeGreaterThanOrEqual(before)
    })

    test('does not overwrite user-provided Ac/Energy/Forward in same payload', () => {
      const instance = { 'Ac/Power': 1000, 'Ac/Energy/Forward': 0 }
      instance._lastPowerTimestamp = Date.now() - 3_600_000

      const result = acload.onPropertiesChanged({
        changes: { 'Ac/Power': 1000, 'Ac/Energy/Forward': 99 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      expect(result['Ac/Energy/Forward']).toBe(99)
    })

    test('updates timestamp on every power change', () => {
      const instance = { 'Ac/Power': 1000, 'Ac/Energy/Forward': 0 }
      instance._lastPowerTimestamp = Date.now() - 3_600_000

      const before = Date.now()
      acload.onPropertiesChanged({
        changes: { 'Ac/Power': 1000 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      expect(instance._lastPowerTimestamp).toBeGreaterThanOrEqual(before)
    })
  })

  describe('onPropertiesChanged - per-phase energy', () => {
    test('accumulates per-phase energy for L1 on second reading', () => {
      const instance = { 'Ac/L1/Power': 500, 'Ac/L1/Energy/Forward': 0 }
      instance._lastL1PowerTimestamp = Date.now() - 3_600_000

      const result = acload.onPropertiesChanged({
        changes: { 'Ac/L1/Power': 500 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      // 500 W for 1 h = 0.5 kWh
      expect(result['Ac/L1/Energy/Forward']).toBeCloseTo(0.5, 2)
    })

    test('sets Ac/Energy/Forward as sum of all phase energies', () => {
      const instance = {
        'Ac/L1/Power': 300,
        'Ac/L2/Power': 600,
        'Ac/L3/Power': 900,
        'Ac/L1/Energy/Forward': 0,
        'Ac/L2/Energy/Forward': 0,
        'Ac/L3/Energy/Forward': 0
      }
      const oneHourAgo = Date.now() - 3_600_000
      instance._lastL1PowerTimestamp = oneHourAgo
      instance._lastL2PowerTimestamp = oneHourAgo
      instance._lastL3PowerTimestamp = oneHourAgo

      const result = acload.onPropertiesChanged({
        changes: { 'Ac/L1/Power': 300, 'Ac/L2/Power': 600, 'Ac/L3/Power': 900 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 3 }
      })
      expect(result['Ac/L1/Energy/Forward']).toBeCloseTo(0.3, 2)
      expect(result['Ac/L2/Energy/Forward']).toBeCloseTo(0.6, 2)
      expect(result['Ac/L3/Energy/Forward']).toBeCloseTo(0.9, 2)
      // Total = 0.3 + 0.6 + 0.9 = 1.8 kWh
      expect(result['Ac/Energy/Forward']).toBeCloseTo(1.8, 2)
    })

    test('includes existing phase energy from instance when only some phases are updated', () => {
      const instance = {
        'Ac/L1/Power': 300,
        'Ac/L1/Energy/Forward': 1.0,
        'Ac/L2/Energy/Forward': 2.0,
        'Ac/L3/Energy/Forward': 3.0
      }
      instance._lastL1PowerTimestamp = Date.now() - 3_600_000

      const result = acload.onPropertiesChanged({
        changes: { 'Ac/L1/Power': 300 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 3 }
      })
      // L1 adds 0.3 kWh to existing 1.0 = 1.3; L2 and L3 unchanged at 2.0 and 3.0
      expect(result['Ac/L1/Energy/Forward']).toBeCloseTo(1.3, 2)
      expect(result['Ac/Energy/Forward']).toBeCloseTo(1.3 + 2.0 + 3.0, 2)
    })

    test('does not accumulate phase energy beyond configured nrOfPhases', () => {
      const instance = { 'Ac/L3/Power': 500 }
      instance._lastL3PowerTimestamp = Date.now() - 3_600_000

      const result = acload.onPropertiesChanged({
        changes: { 'Ac/L3/Power': 500 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      // 1-phase config - L3 should not be touched
      expect(result['Ac/L3/Energy/Forward']).toBeUndefined()
    })

    test('does not overwrite user-provided Ac/Energy/Forward even when phases update', () => {
      const instance = {
        'Ac/L1/Power': 1000,
        'Ac/L1/Energy/Forward': 0
      }
      instance._lastL1PowerTimestamp = Date.now() - 3_600_000

      const result = acload.onPropertiesChanged({
        changes: { 'Ac/L1/Power': 1000, 'Ac/Energy/Forward': 99 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      expect(result['Ac/Energy/Forward']).toBe(99)
    })
  })

  describe('onPropertiesChanged - Ac/Power fallback (no per-phase data)', () => {
    test('uses Ac/Power when no phase powers are in changes', () => {
      const instance = { 'Ac/Power': 1000, 'Ac/Energy/Forward': 0 }
      instance._lastPowerTimestamp = Date.now() - 3_600_000

      const result = acload.onPropertiesChanged({
        changes: { 'Ac/Power': 1000 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      expect(result['Ac/Energy/Forward']).toBeCloseTo(1.0, 2)
    })

    test('does not use Ac/Power fallback when phase powers are also in changes', () => {
      const instance = {
        'Ac/Power': 1000,
        'Ac/L1/Power': 1000,
        'Ac/Energy/Forward': 0,
        'Ac/L1/Energy/Forward': 0
      }
      const oneHourAgo = Date.now() - 3_600_000
      instance._lastPowerTimestamp = oneHourAgo
      instance._lastL1PowerTimestamp = oneHourAgo

      const result = acload.onPropertiesChanged({
        changes: { 'Ac/Power': 1000, 'Ac/L1/Power': 1000 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      // Energy comes from L1 phase sum (1.0 kWh), not double-counted from Ac/Power
      expect(result['Ac/Energy/Forward']).toBeCloseTo(1.0, 2)
    })

    test('updates _lastPowerTimestamp even when per-phase data drives the update', () => {
      const instance = {
        'Ac/Power': 500,
        'Ac/L1/Power': 500,
        'Ac/Energy/Forward': 0,
        'Ac/L1/Energy/Forward': 0
      }
      const tenHoursAgo = Date.now() - 36_000_000
      instance._lastPowerTimestamp = tenHoursAgo
      instance._lastL1PowerTimestamp = Date.now() - 3_600_000

      acload.onPropertiesChanged({
        changes: { 'Ac/Power': 500, 'Ac/L1/Power': 500 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })

      expect(instance._lastPowerTimestamp).toBeGreaterThan(tenHoursAgo)

      // Now send Ac/Power only - must NOT produce a huge delta
      const result = acload.onPropertiesChanged({
        changes: { 'Ac/Power': 500 },
        instance,
        config: { acload_auto_energy: true, acload_nrofphases: 1 }
      })
      expect(result['Ac/Energy/Forward'] ?? 0).toBeCloseTo(0, 3)
    })
  })
})
