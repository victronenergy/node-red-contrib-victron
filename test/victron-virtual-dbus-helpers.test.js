/* eslint-env jest */

const { sanitizeIdForDbus, createDebouncedSetters } = require('../src/nodes/victron-virtual-dbus-helpers')
const { debounce } = require('../src/services/utils')

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

describe('createDebouncedSetters', () => {
  const DELAY = 100

  function createNode (properties) {
    return { ifaceDesc: { properties }, setValuesLocally: jest.fn(), error: jest.fn() }
  }

  const properties = {
    'Position/Latitude': { type: 'd', debounceGroup: 'position' },
    'Position/Longitude': { type: 'd', debounceGroup: 'position' },
    Speed: { type: 'd' }
  }

  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  describe('getDebouncedSetter', () => {
    test('applies an ungrouped key on its own after the delay', () => {
      const node = createNode(properties)
      const { getDebouncedSetter } = createDebouncedSetters(node, debounce, DELAY)

      getDebouncedSetter('Speed')(1)
      getDebouncedSetter('Speed')(2)
      expect(node.setValuesLocally).not.toHaveBeenCalled()

      jest.advanceTimersByTime(DELAY)
      expect(node.setValuesLocally).toHaveBeenCalledTimes(1)
      expect(node.setValuesLocally).toHaveBeenCalledWith({ Speed: 2 })
    })

    test('applies keys of the same debounceGroup in one update', () => {
      const node = createNode(properties)
      const { getDebouncedSetter } = createDebouncedSetters(node, debounce, DELAY)

      getDebouncedSetter('Position/Latitude')(52.1)
      getDebouncedSetter('Position/Longitude')(5.1)
      jest.advanceTimersByTime(DELAY)

      expect(node.setValuesLocally).toHaveBeenCalledTimes(1)
      expect(node.setValuesLocally).toHaveBeenCalledWith({ 'Position/Latitude': 52.1, 'Position/Longitude': 5.1 })
    })

    test('keeps the group separate from ungrouped keys', () => {
      const node = createNode(properties)
      const { getDebouncedSetter } = createDebouncedSetters(node, debounce, DELAY)

      getDebouncedSetter('Position/Latitude')(52.1)
      getDebouncedSetter('Speed')(3)
      jest.advanceTimersByTime(DELAY)

      expect(node.setValuesLocally).toHaveBeenCalledWith({ 'Position/Latitude': 52.1 })
      expect(node.setValuesLocally).toHaveBeenCalledWith({ Speed: 3 })
    })
  })

  describe('grouped keys', () => {
    test('merges values from separate messages within the delay', () => {
      const node = createNode(properties)
      const { getDebouncedSetter } = createDebouncedSetters(node, debounce, DELAY)

      getDebouncedSetter('Position/Latitude')(52.1)
      getDebouncedSetter('Position/Longitude')(5.1)
      jest.advanceTimersByTime(DELAY / 2)
      getDebouncedSetter('Position/Latitude')(52.2)
      jest.advanceTimersByTime(DELAY)

      expect(node.setValuesLocally).toHaveBeenCalledTimes(1)
      expect(node.setValuesLocally).toHaveBeenCalledWith({ 'Position/Latitude': 52.2, 'Position/Longitude': 5.1 })
    })

    test('does not re-apply values from an earlier update', () => {
      const node = createNode(properties)
      const { getDebouncedSetter } = createDebouncedSetters(node, debounce, DELAY)

      getDebouncedSetter('Position/Latitude')(52.1)
      getDebouncedSetter('Position/Longitude')(5.1)
      jest.advanceTimersByTime(DELAY)
      getDebouncedSetter('Position/Longitude')(5.2)
      jest.advanceTimersByTime(DELAY)

      expect(node.setValuesLocally).toHaveBeenLastCalledWith({ 'Position/Longitude': 5.2 })
    })

    // The node help documents payload keys with a leading slash
    test('groups keys given with a leading slash', () => {
      const node = createNode(properties)
      const { getDebouncedSetter } = createDebouncedSetters(node, debounce, DELAY)

      getDebouncedSetter('/Position/Latitude')(52.1)
      getDebouncedSetter('/Position/Longitude')(5.1)
      jest.advanceTimersByTime(DELAY)

      expect(node.setValuesLocally).toHaveBeenCalledTimes(1)
      expect(node.setValuesLocally).toHaveBeenCalledWith({ '/Position/Latitude': 52.1, '/Position/Longitude': 5.1 })
    })

    test('reports a failing update and recovers on the next one', () => {
      const node = createNode(properties)
      node.setValuesLocally.mockImplementationOnce(() => { throw new Error('boom') })
      const { getDebouncedSetter } = createDebouncedSetters(node, debounce, DELAY)

      getDebouncedSetter('Position/Latitude')(52.1)
      jest.advanceTimersByTime(DELAY)
      expect(node.error).toHaveBeenCalledWith(expect.stringContaining('boom'))

      getDebouncedSetter('Position/Longitude')(5.2)
      jest.advanceTimersByTime(DELAY)
      expect(node.setValuesLocally).toHaveBeenLastCalledWith({ 'Position/Longitude': 5.2 })
    })
  })

  describe('shouldApplyImmediately', () => {
    test.each(['Start', '/Start'])('honours the immediate flag for %s', (key) => {
      const { shouldApplyImmediately } = createDebouncedSetters(createNode({ Start: { type: 'i', immediate: true } }), debounce, DELAY)
      expect(shouldApplyImmediately(key)).toBe(true)
    })
  })
})
