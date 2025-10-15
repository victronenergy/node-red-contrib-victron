// test/victron-virtual-functions.test.js
const {
  checkGeneratorType,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  updateBatteryVoltageVisibility
} = require('./fixtures/victron-virtual-functions.cjs')

const { SWITCH_TYPE_MAP } = require('../src/nodes/victron-virtual-constants')

function createMockElement(customValues = {}) {
  const mockDOMElement = {
    setCustomValidity: jest.fn(),
    reportValidity: jest.fn().mockReturnValue(customValues.reportValidity !== false)
  }

  return {
    val: jest.fn().mockReturnValue(customValues.val || ''),
    show: jest.fn().mockReturnThis(),
    hide: jest.fn().mockReturnThis(),
    toggle: jest.fn().mockReturnThis(),
    prop: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnValue(customValues.is || false),
    off: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    empty: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
    closest: jest.fn().mockReturnThis(),
    after: jest.fn().mockReturnThis(),
    length: customValues.length !== undefined ? customValues.length : 1,
    0: mockDOMElement
  }
}

global.$ = jest.fn()

describe('General victron-virtual-functions coverage (non-switch)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkGeneratorType', () => {
    test('shows DC elements and hides AC elements when DC generator selected', () => {
      const mockDCElements = createMockElement()
      const mockACElements = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-generator_type') {
          return createMockElement({ val: 'dc' })
        }
        if (selector === '.dc-generator-only') {
          return mockDCElements
        }
        if (selector === '.ac-generator-only') {
          return mockACElements
        }
        return createMockElement()
      })

      checkGeneratorType()

      expect(mockDCElements.show).toHaveBeenCalled()
      expect(mockACElements.hide).toHaveBeenCalled()
    })

    test('shows AC elements and hides DC elements when AC generator selected', () => {
      const mockDCElements = createMockElement()
      const mockACElements = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-generator_type') {
          return createMockElement({ val: 'ac' })
        }
        if (selector === '.dc-generator-only') {
          return mockDCElements
        }
        if (selector === '.ac-generator-only') {
          return mockACElements
        }
        return createMockElement()
      })

      checkGeneratorType()

      expect(mockDCElements.hide).toHaveBeenCalled()
      expect(mockACElements.show).toHaveBeenCalled()
    })
  })

  describe('checkGeneratorType edge cases (lines 222-225)', () => {
    test('handles non-DC generator type (AC path)', () => {
      const mockDCElements = createMockElement()
      const mockACElements = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-generator_type') {
          return createMockElement({ val: 'ac' }) // Non-DC value
        }
        if (selector === '.dc-generator-only') {
          return mockDCElements
        }
        if (selector === '.ac-generator-only') {
          return mockACElements
        }
        return createMockElement()
      })

      checkGeneratorType()

      // Should take the else branch (lines 222-225)
      expect(mockDCElements.hide).toHaveBeenCalled()
      expect(mockACElements.show).toHaveBeenCalled()
    })

    test('handles undefined generator type (defaults to AC)', () => {
      const mockDCElements = createMockElement()
      const mockACElements = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-generator_type') {
          return createMockElement({ val: undefined })
        }
        if (selector === '.dc-generator-only') {
          return mockDCElements
        }
        if (selector === '.ac-generator-only') {
          return mockACElements
        }
        return createMockElement()
      })

      checkGeneratorType()

      // Should take the else branch when undefined
      expect(mockDCElements.hide).toHaveBeenCalled()
      expect(mockACElements.show).toHaveBeenCalled()
    })
  })

  describe('updateSwitchConfig edge case (line 247)', () => {
    test('handles context binding correctly', () => {
      const mockContainer = createMockElement()
      const context = { someProperty: 'test' }

      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'switch' })
        }
        if (selector === '#node-input-switch_count') {
          return createMockElement({ val: '1' })
        }
        if (selector === '#switch-config-container') {
          return mockContainer
        }
        return createMockElement()
      })

      // Call with specific context to test binding (line 247)
      updateSwitchConfig(context)

      expect(mockContainer.empty).toHaveBeenCalled()
    })
  })

  describe('checkSelectedVirtualDevice', () => {
    test('hides all device inputs initially', () => {
      const mockBatteryInput = createMockElement()
      const mockGeneratorInput = createMockElement()
      const mockSwitchInput = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'battery' })
        }
        if (selector === '.input-battery') {
          return mockBatteryInput
        }
        if (selector === '.input-generator') {
          return mockGeneratorInput
        }
        if (selector === '.input-switch') {
          return mockSwitchInput
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice()

      expect(mockBatteryInput.hide).toHaveBeenCalled()
      expect(mockGeneratorInput.hide).toHaveBeenCalled()
      expect(mockSwitchInput.hide).toHaveBeenCalled()
    })

    test('shows selected device input', () => {
      const mockSelectedInput = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'battery' })
        }
        if (selector === '.input-battery') {
          return mockSelectedInput
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice()

      expect(mockSelectedInput.show).toHaveBeenCalled()
    })

    test('handles temperature device selection with battery checkbox', () => {
      const mockBatteryCheckbox = createMockElement({ is: true })
      const mockBatteryRow = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'temperature' })
        }
        if (selector === '#node-input-include-battery') {
          return mockBatteryCheckbox
        }
        if (selector === '#battery-voltage-row') {
          return mockBatteryRow
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice()

      expect(mockBatteryCheckbox.off).toHaveBeenCalledWith('change')
      expect(mockBatteryCheckbox.on).toHaveBeenCalledWith('change', expect.any(Function))
      expect(mockBatteryRow.toggle).toHaveBeenCalledWith(true)
    })

    test('handles generator device selection', () => {
      const mockDCElements = createMockElement()
      const mockACElements = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'generator' })
        }
        if (selector === 'select#node-input-generator_type') {
          return createMockElement({ val: 'dc' })
        }
        if (selector === '.dc-generator-only') {
          return mockDCElements
        }
        if (selector === '.ac-generator-only') {
          return mockACElements
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice()

      expect(mockDCElements.show).toHaveBeenCalled()
      expect(mockACElements.hide).toHaveBeenCalled()
    })

    test('handles GPS device selection', () => {
      const mockDefaultValues = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'gps' })
        }
        if (selector === '#node-input-default_values') {
          return mockDefaultValues
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice()

      expect(mockDefaultValues.prop).toHaveBeenCalledWith('checked', false)
      expect(mockDefaultValues.prop).toHaveBeenCalledWith('disabled', true)
    })

    test('enables default values for non-GPS devices', () => {
      const mockDefaultValues = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'battery' })
        }
        if (selector === '#node-input-default_values') {
          return mockDefaultValues
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice()

      expect(mockDefaultValues.prop).toHaveBeenCalledWith('disabled', false)
    })

    test('handles switch device selection with context', () => {
      const mockContainer = createMockElement()
      const context = {}

      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'switch' })
        }
        if (selector === '#switch-config-container') {
          return mockContainer
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice(context)

      // Only check that the switch config container is emptied for a switch device
      expect(mockContainer.empty).toHaveBeenCalled()
    })
  })

  describe('updateSwitchConfig', () => {
    test('returns early when device is not switch', () => {
      const mockContainer = createMockElement()
      const context = {}

      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'battery' })
        }
        if (selector === '#switch-config-container') {
          return mockContainer
        }
        return createMockElement()
      })

      updateSwitchConfig.call(context)

      expect(mockContainer.empty).toHaveBeenCalled()
    })

  })

  describe('updateBatteryVoltageVisibility', () => {
    test('shows voltage row and hides custom fields when default values enabled and preset is standard', () => {
      const mockDefaultValues = createMockElement({ is: true })
      const mockBatteryVoltagePreset = createMockElement({ val: 'standard' })
      const mockBatteryVoltageRow = createMockElement()
      const mockBatteryVoltageCustom = createMockElement()
      const mockBatteryVoltageCustomLabel = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-default_values') {
          return mockDefaultValues
        }
        if (selector === '#node-input-battery_voltage_preset') {
          return mockBatteryVoltagePreset
        }
        if (selector === '#battery-voltage-row') {
          return mockBatteryVoltageRow
        }
        if (selector === '#node-input-battery_voltage_custom') {
          return mockBatteryVoltageCustom
        }
        if (selector === '#battery-voltage-custom-label') {
          return mockBatteryVoltageCustomLabel
        }
        return createMockElement()
      })

      updateBatteryVoltageVisibility()

      expect(mockBatteryVoltageRow.toggle).toHaveBeenCalledWith(true)
      expect(mockBatteryVoltageCustom.toggle).toHaveBeenCalledWith(false)
      expect(mockBatteryVoltageCustomLabel.toggle).toHaveBeenCalledWith(false)
    })

    test('hides voltage row when default values disabled', () => {
      const mockDefaultValues = createMockElement({ is: false })
      const mockBatteryVoltagePreset = createMockElement({ val: 'standard' })
      const mockBatteryVoltageRow = createMockElement()
      const mockBatteryVoltageCustom = createMockElement()
      const mockBatteryVoltageCustomLabel = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-default_values') {
          return mockDefaultValues
        }
        if (selector === '#node-input-battery_voltage_preset') {
          return mockBatteryVoltagePreset
        }
        if (selector === '#battery-voltage-row') {
          return mockBatteryVoltageRow
        }
        if (selector === '#node-input-battery_voltage_custom') {
          return mockBatteryVoltageCustom
        }
        if (selector === '#battery-voltage-custom-label') {
          return mockBatteryVoltageCustomLabel
        }
        return createMockElement()
      })

      updateBatteryVoltageVisibility()

      expect(mockBatteryVoltageRow.toggle).toHaveBeenCalledWith(false)
      expect(mockBatteryVoltageCustom.toggle).toHaveBeenCalledWith(false)
      expect(mockBatteryVoltageCustomLabel.toggle).toHaveBeenCalledWith(false)
    })

    test('shows custom fields when preset is custom', () => {
      const mockDefaultValues = createMockElement({ is: true })
      const mockBatteryVoltagePreset = createMockElement({ val: 'custom' })
      const mockBatteryVoltageRow = createMockElement()
      const mockBatteryVoltageCustom = createMockElement()
      const mockBatteryVoltageCustomLabel = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-default_values') {
          return mockDefaultValues
        }
        if (selector === '#node-input-battery_voltage_preset') {
          return mockBatteryVoltagePreset
        }
        if (selector === '#battery-voltage-row') {
          return mockBatteryVoltageRow
        }
        if (selector === '#node-input-battery_voltage_custom') {
          return mockBatteryVoltageCustom
        }
        if (selector === '#battery-voltage-custom-label') {
          return mockBatteryVoltageCustomLabel
        }
        return createMockElement()
      })

      updateBatteryVoltageVisibility()

      expect(mockBatteryVoltageRow.toggle).toHaveBeenCalledWith(true)
      expect(mockBatteryVoltageCustom.toggle).toHaveBeenCalledWith(true)
      expect(mockBatteryVoltageCustomLabel.toggle).toHaveBeenCalledWith(true)
    })

    test('handles edge case when preset is undefined', () => {
      const mockDefaultValues = createMockElement({ is: true })
      const mockBatteryVoltagePreset = createMockElement({ val: undefined })
      const mockBatteryVoltageRow = createMockElement()
      const mockBatteryVoltageCustom = createMockElement()
      const mockBatteryVoltageCustomLabel = createMockElement()
      
      global.$.mockImplementation((selector) => {
        if (selector === '#node-input-default_values') {
          return mockDefaultValues
        }
        if (selector === '#node-input-battery_voltage_preset') {
          return mockBatteryVoltagePreset
        }
        if (selector === '#battery-voltage-row') {
          return mockBatteryVoltageRow
        }
        if (selector === '#node-input-battery_voltage_custom') {
          return mockBatteryVoltageCustom
        }
        if (selector === '#battery-voltage-custom-label') {
          return mockBatteryVoltageCustomLabel
        }
        return createMockElement()
      })

      updateBatteryVoltageVisibility()

      expect(mockBatteryVoltageRow.toggle).toHaveBeenCalledWith(true)
      expect(mockBatteryVoltageCustom.toggle).toHaveBeenCalledWith(false)
      expect(mockBatteryVoltageCustomLabel.toggle).toHaveBeenCalledWith(false)
    })
  })
})