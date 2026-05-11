const { formatEvent, validateEventInput } = require('../src/nodes/victron-event-functions')

describe('formatEvent', () => {
  it('formats eventType, severity, app and message tab-separated', () => {
    expect(formatEvent(1, 0, 'node-red', 'Something happened')).toBe('1\t0\tnode-red\tSomething happened')
  })

  it('sanitizes tab characters in app and message', () => {
    expect(formatEvent(1, 1, 'my\tapp', 'msg\twith\ttabs')).toBe('1\t1\tmy app\tmsg with tabs')
  })

  it('sanitizes newline characters in app and message', () => {
    expect(formatEvent(1, 2, 'app\nname', 'line1\nline2')).toBe('1\t2\tapp name\tline1 line2')
  })

  it('trims whitespace from app and message', () => {
    expect(formatEvent(1, 0, '  node-red  ', '  event message  ')).toBe('1\t0\tnode-red\tevent message')
  })

  it('passes eventType and severity through as-is', () => {
    expect(formatEvent(0, 2, 'app', 'msg')).toBe('0\t2\tapp\tmsg')
  })
})

describe('validateEventInput', () => {
  describe('valid inputs', () => {
    it('accepts valid payload, numeric severity and app', () => {
      const result = validateEventInput('Something happened', 0, 'node-red')
      expect(result.valid).toBe(true)
      expect(result.severity).toBe(0)
      expect(result.app).toBe('node-red')
      expect(result.message).toBe('Something happened')
    })

    it.each([
      ['warning', 0],
      ['critical', 1],
      ['info', 2],
      ['information', 2],
      ['WARNING', 0],
      ['CRITICAL', 1],
      ['INFO', 2]
    ])('accepts severity string "%s" -> %i', (str, num) => {
      const result = validateEventInput('msg', str, 'app')
      expect(result.valid).toBe(true)
      expect(result.severity).toBe(num)
    })

    it.each(['0', '1', '2'])('accepts severity as numeric string "%s"', (str) => {
      const result = validateEventInput('msg', str, 'app')
      expect(result.valid).toBe(true)
      expect(result.severity).toBe(parseInt(str, 10))
    })

    it('trims the app name', () => {
      const result = validateEventInput('msg', 0, '  node-red  ')
      expect(result.valid).toBe(true)
      expect(result.app).toBe('node-red')
    })
  })

  describe('invalid inputs', () => {
    it.each([null, undefined, ''])('rejects empty payload: %s', (payload) => {
      const result = validateEventInput(payload, 0, 'app')
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/payload/i)
    })

    it.each([null, undefined, ''])('rejects empty app: %s', (app) => {
      const result = validateEventInput('msg', 0, app)
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/app/i)
    })

    it('rejects app that is only whitespace', () => {
      const result = validateEventInput('msg', 0, '   ')
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/app/i)
    })

    it.each([3, -1, 1.5])('rejects out-of-range numeric severity: %s', (sev) => {
      const result = validateEventInput('msg', sev, 'app')
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/severity/i)
    })

    it('rejects unknown severity string', () => {
      const result = validateEventInput('msg', 'alarm', 'app')
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/severity/i)
    })

    it('rejects non-string/number severity', () => {
      const result = validateEventInput('msg', true, 'app')
      expect(result.valid).toBe(false)
      expect(result.error).toMatch(/severity/i)
    })
  })
})
