// test/victron-virtual-device-types.test.js
/* eslint-env jest */
const fs = require('fs')
const path = require('path')

const deviceTypeDir = path.join(__dirname, '../src/nodes/victron-virtual/device-type')

const moduleFiles = fs.readdirSync(deviceTypeDir)
  .filter(f => f.endsWith('.js'))
  .map(f => ({ name: path.basename(f, '.js'), mod: require(path.join(deviceTypeDir, f)) }))

function buildProperties (module) {
  if (typeof module.properties === 'function') {
    return module.properties({})
  }
  return module.properties
}

describe('virtual device type module contracts', () => {
  test.each(moduleFiles)('$name exports properties as an object', ({ mod }) => {
    expect(mod.properties).toBeDefined()
    const properties = buildProperties(mod)
    expect(typeof properties).toBe('object')
    expect(Array.isArray(mod.properties)).toBe(false)
  })

  test.each(moduleFiles)('$name exports initialize as a function', ({ mod }) => {
    expect(typeof mod.initialize).toBe('function')
  })

  test.each(moduleFiles)('$name.properties has at least one entry', ({ mod }) => {
    const properties = buildProperties(mod)
    expect(Object.keys(properties).length).toBeGreaterThan(0)
  })

  test.each(moduleFiles)('$name.label is a non-empty string if present', ({ mod }) => {
    if (mod.label !== undefined) {
      expect(typeof mod.label).toBe('string')
      expect(mod.label.length).toBeGreaterThan(0)
    }
  })
})
