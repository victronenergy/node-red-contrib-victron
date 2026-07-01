/* eslint-env jest */

const { sanitizeIdForDbus } = require('../src/nodes/victron-virtual-dbus-helpers')

describe('sanitizeIdForDbus', () => {
  it('leaves purely alphanumeric IDs unchanged', () => {
    expect(sanitizeIdForDbus('a1b2c3d4e5f6a7b8')).toBe('a1b2c3d4e5f6a7b8')
  })

  it('leaves underscores unchanged', () => {
    expect(sanitizeIdForDbus('abc_123')).toBe('abc_123')
  })

  it('replaces the hyphen introduced by subflow instance ID concatenation', () => {
    expect(sanitizeIdForDbus('abc12345.56789abc-def67890.12345def')).toBe('abc12345_56789abc_def67890_12345def')
  })

  it('replaces dots in old-format Node-RED IDs', () => {
    expect(sanitizeIdForDbus('3f4a9c2d.5e6b78')).toBe('3f4a9c2d_5e6b78')
  })

  it('handles empty string', () => {
    expect(sanitizeIdForDbus('')).toBe('')
  })
})
