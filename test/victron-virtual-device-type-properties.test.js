// test/victron-virtual-device-type-properties.test.js
/* eslint-env jest */
const fs = require('fs')
const path = require('path')
const { __private__: { wrapValue } } = require('dbus-victron-virtual')

const DEVICE_TYPE_DIR = path.join(__dirname, '../src/nodes/victron-virtual/device-type')

const SAMPLE_VALUES = {
  b: true,
  d: 1.0,
  i: 1,
  s: 'test',
  u: 1,
  ad: [1.0],
  ai: [1],
  as: ['test']
}

// Flatten possibly-nested property maps (e.g. generator.js uses { genset: {...}, dcgenset: {...} })
function flattenProperties (properties) {
  const result = {}
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value.type === 'string') {
      result[key] = value
    } else {
      Object.assign(result, value)
    }
  }
  return result
}

const deviceModuleFiles = fs.readdirSync(DEVICE_TYPE_DIR).filter(f => f.endsWith('.js'))

describe('virtual device-type property types are wrappable by dbus-victron-virtual', () => {
  for (const file of deviceModuleFiles) {
    const mod = require(path.join(DEVICE_TYPE_DIR, file))
    if (!mod.properties) continue

    const allProperties = flattenProperties(mod.properties)

    describe(file, () => {
      for (const [propName, propDesc] of Object.entries(allProperties)) {
        test(`${propName} (type '${propDesc.type}') wraps to [signature, value]`, () => {
          const sampleValue = SAMPLE_VALUES[propDesc.type]
          expect(sampleValue).toBeDefined()
          const result = wrapValue(propDesc, sampleValue)
          expect(Array.isArray(result)).toBe(true)
          expect(result).toHaveLength(2)
        })
      }
    })
  }
})
