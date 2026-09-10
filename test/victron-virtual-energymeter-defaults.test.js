/* eslint-env jest */
/**
 * Regression test for issue #570.
 *
 * The Node-RED editor only retains a node's properties across a deploy if
 * they are declared in RED.nodes.registerType's `defaults` object (in the
 * node's .html file). Any config key read by a device-type module at
 * runtime but missing from `defaults` is silently dropped on the next
 * editor deploy - even a deploy of an unrelated node.
 *
 * This asserts every `config.energymeter_*` key read by
 * device-type/energymeter.js is declared in victron-virtual.html's
 * `defaults`, so this class of bug can't silently reappear for this
 * device type.
 */

const fs = require('fs')
const path = require('path')

const energymeterSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'nodes', 'victron-virtual', 'device-type', 'energymeter.js'),
  'utf8'
)
const htmlSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'nodes', 'victron-virtual.html'),
  'utf8'
)

const configKeys = [...new Set(
  [...energymeterSource.matchAll(/config\.(energymeter_\w+)/g)].map(m => m[1])
)]

describe('victron-virtual.html defaults - energymeter', () => {
  test('device-type/energymeter.js reads at least the known config keys', () => {
    // guards against the regex above silently matching nothing if the source changes shape
    expect(configKeys).toEqual(expect.arrayContaining([
      'energymeter_role',
      'energymeter_position',
      'energymeter_nrofphases',
      'energymeter_phasesetting'
    ]))
  })

  test.each(configKeys)('"%s" is declared in the editor defaults', (key) => {
    const declared = new RegExp(`\\b${key}\\s*:\\s*\\{`).test(htmlSource)
    expect(declared).toBe(true)
  })
})
