// test/victron-virtual-device-type-properties.test.js
/* eslint-env jest */
const fs = require('fs')
const path = require('path')

const DEVICE_TYPE_DIR = path.join(__dirname, '../src/nodes/victron-virtual/device-type')

const KNOWN_TYPES = ['b', 'd', 'i', 's', 'u', 'ad', 'ai', 'as']

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

describe('virtual device-type property types are known D-Bus types', () => {
  for (const file of deviceModuleFiles) {
    const mod = require(path.join(DEVICE_TYPE_DIR, file))
    if (!mod.properties) continue

    const allProperties = flattenProperties(mod.properties)

    describe(file, () => {
      for (const [propName, propDesc] of Object.entries(allProperties)) {
        test(`${propName} type '${propDesc.type}' is a known D-Bus type`, () => {
          expect(KNOWN_TYPES).toContain(propDesc.type)
        })
      }
    })
  }
})
