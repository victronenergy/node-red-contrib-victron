const { debounce } = require('../src/services/utils')
const { DEBOUNCE_DELAY_MS } = require('../src/nodes/victron-virtual-constants')

describe('victron-virtual debouncing logic', () => {
  let mockSetValuesLocally

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockSetValuesLocally = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  function createTestNode (ifaceDesc) {
    const node = {
      setValuesLocally: mockSetValuesLocally,
      ifaceDesc,
      error: jest.fn()
    }
    return node
  }

  function shouldApplyImmediately (node, key) {
    if (node.ifaceDesc && node.ifaceDesc.properties && node.ifaceDesc.properties[key]) {
      return node.ifaceDesc.properties[key].immediate === true
    }
    return false
  }

  function simulateInput (node, payload) {
    if (!node.debouncedSetters) {
      node.debouncedSetters = new Map()
    }

    function getDebouncedSetter (key) {
      if (!node.debouncedSetters.has(key)) {
        const setter = debounce((value) => {
          try {
            node.setValuesLocally({ [key]: value })
          } catch (err) {
            node.error(`Failed to apply debounced value for ${key}: ${err.message}`)
          }
        }, DEBOUNCE_DELAY_MS)
        node.debouncedSetters.set(key, setter)
      }
      return node.debouncedSetters.get(key)
    }

    const immediatePayload = {}
    const debouncedPayload = {}

    for (const [key, value] of Object.entries(payload)) {
      if (shouldApplyImmediately(node, key)) {
        immediatePayload[key] = value
      } else {
        debouncedPayload[key] = value
      }
    }

    if (Object.keys(immediatePayload).length > 0) {
      node.setValuesLocally(immediatePayload)
    }

    for (const [key, value] of Object.entries(debouncedPayload)) {
      const setter = getDebouncedSetter(key)
      setter(value)
    }
  }

  describe('Settings/Type debouncing', () => {
    test('should debounce rapid Settings/Type changes', () => {
      const node = createTestNode({
        properties: {
          'SwitchableOutput/output_1/Settings/Type': {
            type: 'i',
            persist: false
            // No immediate flag - should be debounced
          }
        }
      })

      // Send rapid alternating values (simulating UI race condition)
      simulateInput(node, { 'SwitchableOutput/output_1/Settings/Type': -1 })
      jest.advanceTimersByTime(50)
      simulateInput(node, { 'SwitchableOutput/output_1/Settings/Type': 7 })
      jest.advanceTimersByTime(50)
      simulateInput(node, { 'SwitchableOutput/output_1/Settings/Type': -1 })
      jest.advanceTimersByTime(50)
      simulateInput(node, { 'SwitchableOutput/output_1/Settings/Type': 7 })

      // At this point, no values should have been applied yet (all debounced)
      expect(mockSetValuesLocally).not.toHaveBeenCalled()

      // After 300ms from the last message, only the final value should be applied
      jest.advanceTimersByTime(300)

      expect(mockSetValuesLocally).toHaveBeenCalledTimes(1)
      expect(mockSetValuesLocally).toHaveBeenCalledWith({
        'SwitchableOutput/output_1/Settings/Type': 7
      })
    })

    test('should apply Settings/Type value after debounce delay with no new messages', () => {
      const node = createTestNode({
        properties: {
          'SwitchableOutput/output_1/Settings/Type': {
            type: 'i',
            persist: false
          }
        }
      })

      simulateInput(node, { 'SwitchableOutput/output_1/Settings/Type': 2 })

      // Should not be called immediately
      expect(mockSetValuesLocally).not.toHaveBeenCalled()

      // After 300ms, should be applied
      jest.advanceTimersByTime(300)

      expect(mockSetValuesLocally).toHaveBeenCalledTimes(1)
      expect(mockSetValuesLocally).toHaveBeenCalledWith({
        'SwitchableOutput/output_1/Settings/Type': 2
      })
    })
  })

  describe('immediate properties', () => {
    test('should apply immediate properties without debouncing', () => {
      const node = createTestNode({
        properties: {
          'SwitchableOutput/output_1/State': {
            type: 'i',
            persist: true,
            immediate: true
          }
        }
      })

      simulateInput(node, { 'SwitchableOutput/output_1/State': 1 })

      // Should be called immediately (no debouncing)
      expect(mockSetValuesLocally).toHaveBeenCalledTimes(1)
      expect(mockSetValuesLocally).toHaveBeenCalledWith({
        'SwitchableOutput/output_1/State': 1
      })
    })

    test('should apply battery measurements immediately', () => {
      const node = createTestNode({
        properties: {
          'Dc/0/Voltage': {
            type: 'd',
            immediate: true
          },
          'Dc/0/Current': {
            type: 'd',
            immediate: true
          },
          Soc: {
            type: 'd',
            persist: 15,
            immediate: true
          }
        }
      })

      simulateInput(node, {
        'Dc/0/Voltage': 12.5,
        'Dc/0/Current': 10.2,
        Soc: 75
      })

      // All should be applied immediately
      expect(mockSetValuesLocally).toHaveBeenCalledTimes(1)
      expect(mockSetValuesLocally).toHaveBeenCalledWith({
        'Dc/0/Voltage': 12.5,
        'Dc/0/Current': 10.2,
        Soc: 75
      })
    })
  })

  describe('mixed immediate and debounced properties', () => {
    test('should split payload and handle immediate vs debounced separately', () => {
      const node = createTestNode({
        properties: {
          'SwitchableOutput/output_1/State': {
            type: 'i',
            persist: true,
            immediate: true
          },
          'SwitchableOutput/output_1/Settings/Type': {
            type: 'i',
            persist: false
            // No immediate flag - debounced
          }
        }
      })

      simulateInput(node, {
        'SwitchableOutput/output_1/State': 1,
        'SwitchableOutput/output_1/Settings/Type': 2
      })

      // State should be applied immediately
      expect(mockSetValuesLocally).toHaveBeenCalledTimes(1)
      expect(mockSetValuesLocally).toHaveBeenCalledWith({
        'SwitchableOutput/output_1/State': 1
      })

      // After 300ms, Settings/Type should be applied
      jest.advanceTimersByTime(300)

      expect(mockSetValuesLocally).toHaveBeenCalledTimes(2)
      expect(mockSetValuesLocally).toHaveBeenNthCalledWith(2, {
        'SwitchableOutput/output_1/Settings/Type': 2
      })
    })
  })

  describe('debounce timer management', () => {
    test('should clear previous timer when new value arrives', () => {
      const node = createTestNode({
        properties: {
          'SwitchableOutput/output_1/Settings/Type': {
            type: 'i',
            persist: false
          }
        }
      })

      // Send first message
      simulateInput(node, { 'SwitchableOutput/output_1/Settings/Type': 1 })

      // Advance time partway through debounce period
      jest.advanceTimersByTime(150)

      // Send second message (should clear first timer)
      simulateInput(node, { 'SwitchableOutput/output_1/Settings/Type': 2 })

      // Advance another 150ms (total 300ms from first message, 150ms from second)
      jest.advanceTimersByTime(150)

      // Should not have been called yet (timer was reset)
      expect(mockSetValuesLocally).not.toHaveBeenCalled()

      // Advance another 150ms (300ms from second message)
      jest.advanceTimersByTime(150)

      // Should now be called with the second value
      expect(mockSetValuesLocally).toHaveBeenCalledTimes(1)
      expect(mockSetValuesLocally).toHaveBeenCalledWith({
        'SwitchableOutput/output_1/Settings/Type': 2
      })
    })
  })
})
