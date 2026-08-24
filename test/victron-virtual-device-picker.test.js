// test/victron-virtual-device-picker.test.js
/* eslint-env jest */
const { DEVICE_TYPES, deviceModules } = require('../src/nodes/victron-virtual/index.js')

describe('virtual device picker', () => {
  test('DEVICE_TYPES includes the new heatpump and evcs types', () => {
    const values = DEVICE_TYPES.map(dt => dt.value)
    expect(values).toContain('heatpump')
    expect(values).toContain('evcs')
  })

  test('DEVICE_TYPES no longer offers energymeter', () => {
    const values = DEVICE_TYPES.map(dt => dt.value)
    expect(values).not.toContain('energymeter')
  })

  test('deviceModules still resolves energymeter for already-deployed nodes', () => {
    expect(deviceModules.energymeter).toBeDefined()
    expect(typeof deviceModules.energymeter.initialize).toBe('function')
  })

  test('dynamically-discovered types are interleaved alphabetically, not appended at the end', () => {
    const labels = DEVICE_TYPES.map(dt => dt.label)
    const indexOf = label => labels.indexOf(label)

    // These are auto-discovered (not in the hardcoded DEVICE_TYPES array), so without sorting
    // they'd land after every hardcoded entry regardless of where they alphabetize.
    expect(indexOf('EV charger')).toBeLessThan(indexOf('Generator'))
    expect(indexOf('Heat pump')).toBeLessThan(indexOf('Meteo'))
    expect(indexOf('Pulse meter')).toBeLessThan(indexOf('PV inverter'))
    expect(indexOf('Pulse meter')).toBeGreaterThan(indexOf('Meteo'))
  })
})
