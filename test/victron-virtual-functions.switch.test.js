// test/victron-virtual-functions.switch.test.js
const {
  SWITCH_TYPE_MAP,
  SWITCH_TYPE_NAMES,
  SWITCH_TYPE_BITMASK_NAMES,
  SWITCH_TYPE_CONFIGS,
  renderSwitchConfigRow,
  validateSwitchConfig,
  isRgbControlType,
  calculateRgbValidTypes,
  getFirstRgbType,
  formatLightControls,
  formatBitmask
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
      Object.values(SWITCH_TYPE_CONFIGS).forEach(cfg => {
        expect(cfg.fields[0].id).toBe('customname');
        expect(cfg.fields[1].id).toBe('group');
      });

      expect(SWITCH_TYPE_CONFIGS[4]).toBeDefined()
      expect(SWITCH_TYPE_CONFIGS[4].label).toBe('Stepped switch')
      expect(SWITCH_TYPE_CONFIGS[4].fields[2].id).toBe('max')
    })
  })

  describe('renderSwitchConfigRow', () => {
    test('renders switch row with correct HTML structure', () => {
      const mockContainer = createMockElement()
      const mockTypeSelect = createMockElement({ val: String(SWITCH_TYPE_MAP.DROPDOWN) })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#switch-config-container') {
          return mockContainer
        }
        if (selector.includes('node-input-switch_1_type')) {
          return mockTypeSelect
        }
        return createMockElement()
      })

      const context = { switch_1_type: SWITCH_TYPE_MAP.DROPDOWN }
      renderSwitchConfigRow(context)

      expect(mockContainer.append).toHaveBeenCalled()
      // The append call should have been made with a jQuery object, not a string
      expect(mockContainer.append).toHaveBeenCalledWith(expect.anything())
      expect(mockTypeSelect.val).toHaveBeenCalledWith(String(SWITCH_TYPE_MAP.DROPDOWN))
    })

    test('uses default type 1 when context has no switch type', () => {
      const mockContainer = createMockElement()
      const mockTypeSelect = createMockElement({ val: String(SWITCH_TYPE_MAP.TOGGLE) })
      
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
      renderSwitchConfigRow(context)

      expect(mockContainer.append).toHaveBeenCalled()
      expect(mockTypeSelect.val).toHaveBeenCalledWith(String(SWITCH_TYPE_MAP.TOGGLE)) // Default type is TOGGLE
    })

    test('sets up event handler for type change', () => {
      const mockContainer = createMockElement()
      const mockTypeSelect = createMockElement({ val: String(SWITCH_TYPE_MAP.DROPDOWN) })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#switch-config-container') {
          return mockContainer
        }
        if (selector.includes('node-input-switch_1_type')) {
          return mockTypeSelect
        }
        return createMockElement()
      })

      const context = { switch_1_type: SWITCH_TYPE_MAP.DROPDOWN }
      renderSwitchConfigRow(context)

      expect(mockTypeSelect.on).toHaveBeenCalledWith('change', expect.any(Function))
    })
  })

  describe('validateSwitchConfig', () => {
    test('returns true when no switches configured', () => {
      global.$.mockImplementation((selector) => {
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true)
    })

    test('returns true for momentary switch (no fields to validate)', () => {
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: String(SWITCH_TYPE_MAP.MOMENTARY) }) // Momentary type
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true)
    })

    test('validates stepped switch max field (STEPPED type)', () => {
      const mockMaxField = createMockElement({ val: '' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: String(SWITCH_TYPE_MAP.STEPPED) })
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
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: String(SWITCH_TYPE_MAP.STEPPED) })
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
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: String(SWITCH_TYPE_MAP.STEPPED) })
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

    test('validates dropdown value is required when value field exists', () => {
      const mockValueField = createMockElement({ val: '' })
      const mockCountField = createMockElement({ val: '2' })
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: '6' })
        }
        if (selector === '#node-input-switch_1_count') {
          return mockCountField
        }
        if (selector === '#node-input-switch_1_value_0') {
          return mockValueField
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(false)
      expect(mockValueField[0].setCustomValidity).toHaveBeenCalledWith('Label is required')
    })

  })

  describe('edge cases', () => {
    test('handles missing switch type gracefully', () => {
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-switch_1_type') {
          return createMockElement({ val: undefined })
        }
        return createMockElement({ length: 0 })
      })

      const result = validateSwitchConfig()
      expect(result).toBe(true) // Should handle gracefully
    })

    test('passes validation when key/value elements do not exist', () => {
      global.$.mockImplementation((selector) => {
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

  describe('RGB Control Functions', () => {
    describe('isRgbControlType', () => {
      test('returns true for RGB_COLOR_WHEEL type (11)', () => {
        expect(isRgbControlType(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)).toBe(true)
      })

      test('returns true for CCT_WHEEL type (12)', () => {
        expect(isRgbControlType(SWITCH_TYPE_MAP.CCT_WHEEL)).toBe(true)
      })

      test('returns true for RGB_WHITE_DIMMER type (13)', () => {
        expect(isRgbControlType(SWITCH_TYPE_MAP.RGB_WHITE_DIMMER)).toBe(true)
      })

      test('returns false for non-RGB control types', () => {
        expect(isRgbControlType(SWITCH_TYPE_MAP.TOGGLE)).toBe(false)
        expect(isRgbControlType(SWITCH_TYPE_MAP.DIMMABLE)).toBe(false)
        expect(isRgbControlType(SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT)).toBe(false)
      })
    })

    describe('calculateRgbValidTypes', () => {
      test('returns bitmask for single RGB_COLOR_WHEEL selection', () => {
        const result = calculateRgbValidTypes(true, false, false)
        expect(result).toBe(1 << 11) // 2048
      })

      test('returns bitmask for single CCT_WHEEL selection', () => {
        const result = calculateRgbValidTypes(false, true, false)
        expect(result).toBe(1 << 12) // 4096
      })

      test('returns bitmask for single RGB_WHITE_DIMMER selection', () => {
        const result = calculateRgbValidTypes(false, false, true)
        expect(result).toBe(1 << 13) // 8192
      })

      test('returns OR\'d bitmask for RGB + CCT selection', () => {
        const result = calculateRgbValidTypes(true, true, false)
        expect(result).toBe((1 << 11) | (1 << 12)) // 2048 | 4096 = 6144
      })

      test('returns OR\'d bitmask for all three selections', () => {
        const result = calculateRgbValidTypes(true, true, true)
        expect(result).toBe((1 << 11) | (1 << 12) | (1 << 13)) // 14336
      })

      test('returns 0 when no selections', () => {
        const result = calculateRgbValidTypes(false, false, false)
        expect(result).toBe(0)
      })
    })

    describe('getFirstRgbType', () => {
      test('returns RGB_COLOR_WHEEL when it is first selected', () => {
        expect(getFirstRgbType(true, false, false)).toBe(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
        expect(getFirstRgbType(true, true, false)).toBe(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
        expect(getFirstRgbType(true, false, true)).toBe(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
      })

      test('returns CCT_WHEEL when it is first selected', () => {
        expect(getFirstRgbType(false, true, false)).toBe(SWITCH_TYPE_MAP.CCT_WHEEL)
        expect(getFirstRgbType(false, true, true)).toBe(SWITCH_TYPE_MAP.CCT_WHEEL)
      })

      test('returns RGB_WHITE_DIMMER when it is the only one selected', () => {
        expect(getFirstRgbType(false, false, true)).toBe(SWITCH_TYPE_MAP.RGB_WHITE_DIMMER)
      })

      test('returns RGB_COLOR_WHEEL as default when none selected', () => {
        expect(getFirstRgbType(false, false, false)).toBe(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
      })
    })

    describe('formatLightControls', () => {
      test('formats RGB_COLOR_WHEEL array correctly', () => {
        const value = JSON.stringify([120, 100, 50, 0, 0])
        const result = formatLightControls(value, SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
        expect(result).toBe('H:120° S:100% B:50%')
      })

      test('formats CCT_WHEEL array correctly', () => {
        const value = JSON.stringify([0, 0, 75, 0, 2700])
        const result = formatLightControls(value, SWITCH_TYPE_MAP.CCT_WHEEL)
        expect(result).toBe('B:75% CT:2700K')
      })

      test('formats RGB_WHITE_DIMMER array correctly', () => {
        const value = JSON.stringify([240, 80, 60, 40, 0])
        const result = formatLightControls(value, SWITCH_TYPE_MAP.RGB_WHITE_DIMMER)
        expect(result).toBe('H:240° S:80% B:60% W:40%')
      })

      test('handles invalid JSON gracefully', () => {
        const result = formatLightControls('invalid json', SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
        expect(result).toBe('invalid json')
      })

      test('handles array with less than 5 elements', () => {
        const value = JSON.stringify([120, 100])
        const result = formatLightControls(value, SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
        expect(result).toBe(value)
      })

      test('handles non-array JSON', () => {
        const value = JSON.stringify({ hue: 120 })
        const result = formatLightControls(value, SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
        expect(result).toBe(value)
      })
    })

    describe('formatBitmask', () => {
      test('returns "None" for null or 0', () => {
        expect(formatBitmask(null, SWITCH_TYPE_BITMASK_NAMES)).toBe('None')
        expect(formatBitmask(0, SWITCH_TYPE_BITMASK_NAMES)).toBe('None')
      })

      test('formats single bit correctly', () => {
        const bitmask = 1 << SWITCH_TYPE_MAP.RGB_COLOR_WHEEL
        const result = formatBitmask(bitmask, SWITCH_TYPE_BITMASK_NAMES)
        expect(result).toBe('RGB wheel')
      })

      test('formats multiple bits correctly', () => {
        const bitmask = (1 << SWITCH_TYPE_MAP.RGB_COLOR_WHEEL) |
                        (1 << SWITCH_TYPE_MAP.CCT_WHEEL) |
                        (1 << SWITCH_TYPE_MAP.RGB_WHITE_DIMMER)
        const result = formatBitmask(bitmask, SWITCH_TYPE_BITMASK_NAMES)
        expect(result).toBe('RGB wheel, CCT wheel, RGB+W dimmer')
      })

      test('works with non-RGB switch types', () => {
        const bitmask = (1 << SWITCH_TYPE_MAP.MOMENTARY) | (1 << SWITCH_TYPE_MAP.TOGGLE)
        const result = formatBitmask(bitmask, SWITCH_TYPE_BITMASK_NAMES)
        expect(result).toBe('Momentary, Toggle')
      })

      test('works with custom name mapping', () => {
        const customMap = { 0: 'First', 2: 'Third', 5: 'Sixth' }
        const bitmask = (1 << 0) | (1 << 2) | (1 << 5) // bits 0, 2, and 5 set
        const result = formatBitmask(bitmask, customMap)
        expect(result).toBe('First, Third, Sixth')
      })

      test('SWITCH_TYPE_NAMES shows RGB types as "RGB control"', () => {
        // Verify that Settings/Type will show "RGB control" for all RGB variants
        expect(SWITCH_TYPE_NAMES[SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]).toBe('RGB control')
        expect(SWITCH_TYPE_NAMES[SWITCH_TYPE_MAP.CCT_WHEEL]).toBe('RGB control')
        expect(SWITCH_TYPE_NAMES[SWITCH_TYPE_MAP.RGB_WHITE_DIMMER]).toBe('RGB control')
      })

      test('SWITCH_TYPE_BITMASK_NAMES shows distinct RGB type names', () => {
        // Verify that ValidTypes will show distinct names for each RGB variant
        expect(SWITCH_TYPE_BITMASK_NAMES[SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]).toBe('RGB wheel')
        expect(SWITCH_TYPE_BITMASK_NAMES[SWITCH_TYPE_MAP.CCT_WHEEL]).toBe('CCT wheel')
        expect(SWITCH_TYPE_BITMASK_NAMES[SWITCH_TYPE_MAP.RGB_WHITE_DIMMER]).toBe('RGB+W dimmer')
      })
    })

    describe('validateSwitchConfig for RGB control', () => {
      test('fails validation when no RGB control checkboxes are selected', () => {
        const mockRgbColorWheel = createMockElement({ val: false })
        mockRgbColorWheel.is = jest.fn().mockReturnValue(false)

        const mockCctWheel = createMockElement({ val: false })
        mockCctWheel.is = jest.fn().mockReturnValue(false)

        const mockRgbWhiteDimmer = createMockElement({ val: false })
        mockRgbWhiteDimmer.is = jest.fn().mockReturnValue(false)

        global.$.mockImplementation((selector) => {
          if (selector === '#node-input-switch_1_type') {
            return createMockElement({ val: String(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL) })
          }
          if (selector === '#node-input-switch_1_rgb_color_wheel') {
            return mockRgbColorWheel
          }
          if (selector === '#node-input-switch_1_cct_wheel') {
            return mockCctWheel
          }
          if (selector === '#node-input-switch_1_rgb_white_dimmer') {
            return mockRgbWhiteDimmer
          }
          return createMockElement({ length: 0 })
        })

        const result = validateSwitchConfig()
        expect(result).toBe(false)
        expect(mockRgbColorWheel[0].setCustomValidity).toHaveBeenCalledWith('At least one RGB control type must be selected')
        expect(mockRgbColorWheel[0].reportValidity).toHaveBeenCalled()
      })

      test('passes validation when at least one RGB control checkbox is selected', () => {
        const mockRgbColorWheel = createMockElement({ val: true })
        mockRgbColorWheel.is = jest.fn().mockReturnValue(true)

        const mockCctWheel = createMockElement({ val: false })
        mockCctWheel.is = jest.fn().mockReturnValue(false)

        const mockRgbWhiteDimmer = createMockElement({ val: false })
        mockRgbWhiteDimmer.is = jest.fn().mockReturnValue(false)

        global.$.mockImplementation((selector) => {
          if (selector === '#node-input-switch_1_type') {
            return createMockElement({ val: String(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL) })
          }
          if (selector === '#node-input-switch_1_rgb_color_wheel') {
            return mockRgbColorWheel
          }
          if (selector === '#node-input-switch_1_cct_wheel') {
            return mockCctWheel
          }
          if (selector === '#node-input-switch_1_rgb_white_dimmer') {
            return mockRgbWhiteDimmer
          }
          return createMockElement({ length: 0 })
        })

        const result = validateSwitchConfig()
        expect(result).toBe(true)
        expect(mockRgbColorWheel[0].setCustomValidity).toHaveBeenCalledWith('')
      })

      test('clears validation messages when multiple RGB control checkboxes are selected', () => {
        const mockRgbColorWheel = createMockElement({ val: true })
        mockRgbColorWheel.is = jest.fn().mockReturnValue(true)

        const mockCctWheel = createMockElement({ val: true })
        mockCctWheel.is = jest.fn().mockReturnValue(true)

        const mockRgbWhiteDimmer = createMockElement({ val: false })
        mockRgbWhiteDimmer.is = jest.fn().mockReturnValue(false)

        global.$.mockImplementation((selector) => {
          if (selector === '#node-input-switch_1_type') {
            return createMockElement({ val: String(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL) })
          }
          if (selector === '#node-input-switch_1_rgb_color_wheel') {
            return mockRgbColorWheel
          }
          if (selector === '#node-input-switch_1_cct_wheel') {
            return mockCctWheel
          }
          if (selector === '#node-input-switch_1_rgb_white_dimmer') {
            return mockRgbWhiteDimmer
          }
          return createMockElement({ length: 0 })
        })

        const result = validateSwitchConfig()
        expect(result).toBe(true)
        expect(mockRgbColorWheel[0].setCustomValidity).toHaveBeenCalledWith('')
        expect(mockCctWheel[0].setCustomValidity).toHaveBeenCalledWith('')
        expect(mockRgbWhiteDimmer[0].setCustomValidity).toHaveBeenCalledWith('')
      })
    })
  })

})