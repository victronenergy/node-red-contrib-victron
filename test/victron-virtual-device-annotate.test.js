// test/victron-virtual-device-annotate.test.js
/* eslint-env jest */

const { annotateDeviceTypesWithCapabilities } = require('../src/nodes/victron-virtual/index.js')

describe('annotateDeviceTypesWithCapabilities', () => {
  test('sets supportsS2 true for modules that declare it', () => {
    const deviceTypes = [{ value: 'acload', label: 'AC Load' }, { value: 'battery', label: 'Battery' }]
    const modules = { acload: { supportsS2: true }, battery: {} }
    const result = annotateDeviceTypesWithCapabilities(deviceTypes, modules)
    expect(result).toBe(deviceTypes)
    expect(deviceTypes).toEqual([
      { value: 'acload', label: 'AC Load', supportsS2: true },
      { value: 'battery', label: 'Battery', supportsS2: false }
    ])
  })

  test('defaults supportsS2 to false when the module is missing or has a truthy-but-not-true value', () => {
    const deviceTypes = [{ value: 'unknown' }, { value: 'weird' }]
    const modules = { weird: { supportsS2: 'yes' } }
    annotateDeviceTypesWithCapabilities(deviceTypes, modules)
    expect(deviceTypes).toEqual([
      { value: 'unknown', supportsS2: false },
      { value: 'weird', supportsS2: false }
    ])
  })
})
