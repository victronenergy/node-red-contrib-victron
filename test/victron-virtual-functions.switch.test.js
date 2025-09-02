// test/victron-virtual-functions.switch.test.js
const {
  SWITCH_TYPE_CONFIGS,
  renderSwitchConfigRow,
  validateSwitchConfig
} = require('./fixtures/victron-virtual-functions.cjs')

// Helper to create mock jQuery element
function createMockElement(customValues = {}) {
  const mockDOMElement = {
    setCustomValidity: jest.fn(),
    reportValidity: jest.fn().mockReturnValue(customValues.reportValidity !== false)
  }

  return {
    val: jest.fn().mockReturnValue(customValues.val || ''),
    show: jest.fn().mockReturnThis(),
    hide: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    empty: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
    closest: jest.fn().mockReturnThis(),
    after: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    0: mockDOMElement,
    length: customValues.length !== undefined ? customValues.length : 1
  }
}

global.$ = jest.fn()

describe('Switch Configuration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SWITCH_TYPE_CONFIGS', () => {
    test('has correct switch type configurations', () => {
      expect(SWITCH_TYPE_CONFIGS[0]).toEqual({
        label: 'Momentary',
        fields: []
      })

      expect(SWITCH_TYPE_CONFIGS[1]).toEqual({
        label: 'Toggle',
        fields: []
      })

      // expect(SWITCH_TYPE_CONFIGS[6]).toBeDefined()
      // expect(SWITCH_TYPE_CONFIGS[6].label).toBe('Dropdown')
      // expect(SWITCH_TYPE_CONFIGS[6].fields).toHaveLength(1)
      // expect(SWITCH_TYPE_CONFIGS[6].fields[0]).toEqual({
      //   id: 'count',
      //   type: 'number',
      //   placeholder: 'Number of options',
      //   title: 'Number of dropdown options',
      //   style: 'width:100px;',
      //   min: '2',
      //   max: '10'
      // })

      expect(SWITCH_TYPE_CONFIGS[4]).toBeDefined()
      expect(SWITCH_TYPE_CONFIGS[4].label).toBe('Stepped switch')
      expect(SWITCH_TYPE_CONFIGS[4].fields[0].id).toBe('max')
    })
  })

  describe('renderSwitchConfigRow', () => {
    test('renders switch row with correct HTML structure', () => {
      const mockContainer = createMockElement()
      const mockTypeSelect = createMockElement({ val: '6' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#switch-config-container') {
          return mockContainer
        }
        if (selector.includes('node-input-switch_1_type')) {
          return mockTypeSelect
        }
        return createMockElement()
      })

      const context = { switch_1_type: 6 }
      renderSwitchConfigRow(1, context)

      expect(mockContainer.append).toHaveBeenCalled()
      // The append call should have been made with a jQuery object, not a string
      expect(mockContainer.append).toHaveBeenCalledWith(expect.anything())
      expect(mockTypeSelect.val).toHaveBeenCalledWith('6')
    })

    test('uses default type 1 when context has no switch type', () => {
      const mockContainer = createMockElement()
      const mockTypeSelect = createMockElement({ val: '1' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#switch-config-container') {
          return mockContainer
        }
        if (selector.includes('node-input-switch_1_type')) {
          return mockTypeSelect
        }
        return createMockElement()
      })

      const context = {} // No switch_1_type defined
      renderSwitchConfigRow(1, context)

      expect(mockContainer.append).toHaveBeenCalled()
      expect(mockTypeSelect.val).toHaveBeenCalledWith('1') // Default type is 1
    })

    test('sets up event handler for type change', () => {
      const mockContainer = createMockElement()
      const mockTypeSelect = createMockElement({ val: '6' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#switch-config-container') {
          return mockContainer
        }
        if (selector.includes('node-input-switch_1_type')) {
          return mockTypeSelect
        }
        return createMockElement()
      })

      const context = { switch_1_type: 6 }
      renderSwitchConfigRow(1, context)

      expect(mockTypeSelect.on).toHaveBeenCalledWith('change', expect.any(Function))
    })
  })

  describe('validateSwitchConfig', () => {
    test('returns true when no switches configured', () => {
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '0' })
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true)
    })

    test('returns true for momentary switch (no fields to validate)', () => {
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '0' }) // Momentary type
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true)
    })

    // test('validates dropdown count field is required', () => {
    //   const mockCountField = createMockElement({ val: '' })
      
    //   global.$.mockImplementation((selector) => {
    //     if (selector === '#node-input-switch_count') {
    //       return createMockElement({ val: '1' })
    //     }
    //     if (selector === '#node-input-switch_1_type') {
    //       return createMockElement({ val: '6' }) // Dropdown type
    //     }
    //     if (selector === '#node-input-switch_1_count') {
    //       return mockCountField
    //     }
    //     return createMockElement({ length: 0 })
    //   })

    //   const result = validateSwitchConfig()
    //   expect(result).toBe(false)
    //   expect(mockCountField[0].setCustomValidity).toHaveBeenCalledWith('This field is required')
    // })

    // test('passes validation for dropdown with valid count', () => {
    //   const mockCountField = createMockElement({ val: '3' })
      
    //   global.$.mockImplementation((selector) => {
    //     if (selector === '#node-input-switch_count') {
    //       return createMockElement({ val: '1' })
    //     }
    //     if (selector === '#node-input-switch_1_type') {
    //       return createMockElement({ val: '6' })
    //     }
    //     if (selector === '#node-input-switch_1_count') {
    //       return mockCountField
    //     }
    //     return createMockElement({ length: 0 })
    //   })

    //   const result = validateSwitchConfig()
    //   expect(result).toBe(true)
    //   expect(mockCountField[0].setCustomValidity).toHaveBeenCalledWith('')
    // })

    test('validates stepped switch max field (type 4)', () => {
      const mockMaxField = createMockElement({ val: '' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '4' })
        }
        if (selector === '#node-input-switch_1_max') {
          return mockMaxField
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(false)
      expect(mockMaxField[0].setCustomValidity).toHaveBeenCalledWith('This field is required')
    })

    test('validates stepped switch max is within range (1-7)', () => {
      const mockMaxField = createMockElement({ val: '10' }) // Above max
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '4' })
        }
        if (selector === '#node-input-switch_1_max') {
          return mockMaxField
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(false)
      expect(mockMaxField[0].setCustomValidity).toHaveBeenCalledWith('Max steps must be between 1 and 7')
    })

    test('passes validation for valid stepped switch max', () => {
      const mockMaxField = createMockElement({ val: '5' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '4' })
        }
        if (selector === '#node-input-switch_1_max') {
          return mockMaxField
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true)
      expect(mockMaxField[0].setCustomValidity).toHaveBeenCalledWith('')
    })

    test('validates dropdown key is required when key field exists', () => {
      const mockKeyField = createMockElement({ val: '' })
      const mockCountField = createMockElement({ val: '2' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '6' })
        }
        if (selector === '#node-input-switch_1_count') {
          return mockCountField
        }
        if (selector === '#node-input-switch_1_key_0') {
          return mockKeyField
        }
        if (selector === '#node-input-switch_1_value_0') {
          return createMockElement({ val: 'value1' })
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(false)
      expect(mockKeyField[0].setCustomValidity).toHaveBeenCalledWith('Key is required')
    })

    test('validates dropdown value is required when value field exists', () => {
      const mockValueField = createMockElement({ val: '' })
      const mockCountField = createMockElement({ val: '2' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '6' })
        }
        if (selector === '#node-input-switch_1_count') {
          return mockCountField
        }
        if (selector === '#node-input-switch_1_key_0') {
          return createMockElement({ val: 'key1' })
        }
        if (selector === '#node-input-switch_1_value_0') {
          return mockValueField
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(false)
      expect(mockValueField[0].setCustomValidity).toHaveBeenCalledWith('Value is required')
    })

    test('validates multiple switches with mixed types', () => {
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '2' })
        }
        // Switch 1: Dropdown type with valid count
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '6' })
        }
        if (selector === '#node-input-switch_1_count') {
          return createMockElement({ val: '3' })
        }
        // Switch 2: Momentary type (no fields to validate)
        if (selector === '#node-input-switch_2_type') {
          return createMockElement({ val: '0' })
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('handles missing switch type gracefully', () => {
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: undefined })
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true) // Should handle gracefully
    })

    test('handles non-numeric switch count', () => {
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: 'invalid' })
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true) // Should default to 1 and process normally
    })

    test('passes validation when key/value elements do not exist', () => {
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '6' })
        }
        if (selector === '#node-input-switch_1_count') {
          return createMockElement({ val: '2' })
        }
        // Key/value elements don't exist (length: 0)
        if (selector.includes('_key_') || selector.includes('_value_')) {
          return createMockElement({ length: 0 })
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true) // Should pass when elements don't exist
    })
  })
})