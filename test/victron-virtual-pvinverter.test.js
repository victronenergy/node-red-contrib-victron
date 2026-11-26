// test/victron-virtual-pvinverter.test.js
/* eslint-env jest */
const pvinverter = require('../src/nodes/victron-virtual/device-type/pvinverter')

describe('pvinverter device module', () => {
  test('exports required contract', () => {
    expect(typeof pvinverter.properties).toBe('object')
    expect(typeof pvinverter.initialize).toBe('function')
    expect(typeof pvinverter.onPropertiesChanged).toBe('function')
  })
})
