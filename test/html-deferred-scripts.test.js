/**
 * Regression test for grey nodes on startup (issue #494).
 *
 * Node-RED's appendConfig() sets hasDeferred=true when it encounters a
 * <script src> tag in a module's HTML. This delays all inline script
 * execution (including RED.nodes.registerType) until the external script
 * loads asynchronously. If the canvas renders before registration finishes,
 * nodes appear grey (#ddd) instead of their configured colour.
 *
 * The fix: no <script src> tags may appear before the first registerType
 * call in any node HTML file. External scripts must be injected dynamically
 * at the END of the inline script block, after all registerType calls.
 */

const fs = require('fs')
const path = require('path')

const HTML_DIR = path.join(__dirname, '..', 'src', 'nodes')

const htmlFiles = fs.readdirSync(HTML_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => ({ name: f, content: fs.readFileSync(path.join(HTML_DIR, f), 'utf8') }))

describe('HTML node files - no deferred <script src> before registerType', () => {
    test.each(htmlFiles)('$name has no <script src> before first registerType call', ({ content }) => {
        const registerTypeIndex = content.indexOf('registerType(')
        if (registerTypeIndex === -1) return // file has no registerType, nothing to check

        const preamble = content.slice(0, registerTypeIndex)

        // Match <script src="..."> or <script src='...'> (case-insensitive on attribute order)
        const deferredScript = /<script\b[^>]*\bsrc\s*=/i.test(preamble)

        expect(deferredScript).toBe(false)
    })
})
