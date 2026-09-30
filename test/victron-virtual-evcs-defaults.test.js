/* eslint-env jest */
/**
 * Every `config.evcs_*` key read by device-type/evcs.js must be declared in
 * victron-virtual.html's `defaults`, otherwise the editor silently drops it on
 * the next deploy (see victron-virtual-energymeter-defaults.test.js, #570).
 */

const fs = require('fs')
const path = require('path')

const evcsSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'nodes', 'victron-virtual', 'device-type', 'evcs.js'),
  'utf8'
)
const htmlSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'nodes', 'victron-virtual.html'),
  'utf8'
)

const configKeys = [...new Set(
  [...evcsSource.matchAll(/config\.(evcs_\w+)/g)].map(m => m[1])
)]

describe('victron-virtual.html defaults - evcs', () => {
  test('device-type/evcs.js reads at least the known config keys', () => {
    expect(configKeys).toEqual(expect.arrayContaining([
      'evcs_position',
      'evcs_nrofphases',
      'evcs_phasesetting'
    ]))
  })

  test.each(configKeys)('"%s" is declared in the editor defaults', (key) => {
    const declared = new RegExp(`\\b${key}\\s*:\\s*\\{`).test(htmlSource)
    expect(declared).toBe(true)
  })
})
