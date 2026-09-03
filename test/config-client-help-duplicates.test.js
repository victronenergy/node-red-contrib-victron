/**
 * Regression test for duplicate Node-RED help blocks in config-client.html.
 *
 * Node-RED's editor looks up help content with:
 *   $("script[data-help-name='" + type + "']").html()
 * jQuery's .html() getter only reads the FIRST element in a matched set, so
 * when the same data-help-name appears more than once in the file, every
 * block after the first is silently never shown - it's dead documentation
 * that can still diverge from what's displayed and mislead future editors.
 *
 * This has already happened: e.g. victron-input-switch/-output-switch had
 * an "Auto mode" block added after the original (State + Dimming only)
 * block, so Auto mode has never actually rendered in the editor.
 *
 * See https://github.com/victronenergy/node-red-contrib-victron/issues/563
 */

const fs = require('fs')
const path = require('path')

const HTML_FILE = path.join(__dirname, '..', 'src', 'nodes', 'config-client.html')
const content = fs.readFileSync(HTML_FILE, 'utf8')

const HELP_SCRIPT_OPEN_TAG = /<script type="text\/x-red" data-help-name="([^"]+)">/g

function findHelpNameCounts (html) {
  const counts = {}
  let match
  while ((match = HELP_SCRIPT_OPEN_TAG.exec(html)) !== null) {
    const name = match[1]
    counts[name] = (counts[name] || 0) + 1
  }
  return counts
}

describe('config-client.html - no duplicate data-help-name blocks', () => {
  const counts = findHelpNameCounts(content)
  const helpNames = Object.keys(counts)

  test('at least one victron-input-switch and victron-output-switch block is present', () => {
    expect(counts['victron-input-switch']).toBeGreaterThan(0)
    expect(counts['victron-output-switch']).toBeGreaterThan(0)
  })

  test.each(helpNames)('%s has exactly one help block', (name) => {
    expect(counts[name]).toBe(1)
  })
})
