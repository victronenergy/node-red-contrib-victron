// test/victron-virtual-functions.test.js
const {
  checkGeneratorType,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  updateBatteryVoltageVisibility,
  updateIndicatorLivePreview,
  updateSwitchLivePreview
} = require('./fixtures/victron-virtual-functions.cjs')

const { SWITCH_TYPE_MAP } = require('../src/nodes/victron-virtual-constants')

function createMockElement (customValues = {}) {
  const mockDOMElement = {
    setCustomValidity: jest.fn(),
    reportValidity: jest.fn().mockReturnValue(customValues.reportValidity !== false)
  }

  return {
    val: jest.fn().mockReturnValue(customValues.val || ''),
    attr: jest.fn().mockReturnValue(customValues.attr || ''),
    html: jest.fn().mockReturnThis(),
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
        if (selector === '#node-input-include_temp_battery') {
          return mockBatteryCheckbox
        }
        if (selector === '#battery-temp_voltage-row') {
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
      const mockDefaultValuesYes = createMockElement()
      const mockDefaultValuesNo = createMockElement()

      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'gps' })
        }
        if (selector === '#node-input-default_values-yes') {
          return mockDefaultValuesYes
        }
        if (selector === '#node-input-default_values-no') {
          return mockDefaultValuesNo
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice()

      expect(mockDefaultValuesYes.prop).toHaveBeenCalledWith('checked', false)
      expect(mockDefaultValuesNo.prop).toHaveBeenCalledWith('checked', true)
      expect(mockDefaultValuesYes.prop).toHaveBeenCalledWith('disabled', true)
    })

    test('enables default values for non-GPS devices', () => {
      const mockDefaultValues = createMockElement()

      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'battery' })
        }
        if (selector === 'input[name="default_values"]') {
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

    test('shows S2 section and wires the change handler for a device with supportsS2 capability', () => {
      const mockS2Section = createMockElement()
      const mockS2Checkbox = createMockElement({ is: false })
      const context = {}

      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'acload' })
        }
        if (selector === '.input-s2support') {
          return mockS2Section
        }
        if (selector === '#node-input-enable_s2support') {
          return mockS2Checkbox
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice(context, { acload: { supportsS2: true } })

      expect(mockS2Section.show).toHaveBeenCalled()
      expect(mockS2Checkbox.off).toHaveBeenCalledWith('change.s2support')
      expect(mockS2Checkbox.on).toHaveBeenCalledWith('change.s2support', expect.any(Function))
    })

    test('hides S2 section and does not wire the change handler for a device without supportsS2 capability', () => {
      const mockS2Section = createMockElement()
      const mockS2Measurement = createMockElement()
      const mockS2Checkbox = createMockElement({ is: false })
      const context = {}

      global.$.mockImplementation((selector) => {
        if (selector === 'select#node-input-device') {
          return createMockElement({ val: 'battery' })
        }
        if (selector === '.input-s2support') {
          return mockS2Section
        }
        if (selector === '.input-s2support-measurement') {
          return mockS2Measurement
        }
        if (selector === '#node-input-enable_s2support') {
          return mockS2Checkbox
        }
        if (selector.startsWith('.input-')) {
          return createMockElement()
        }
        return createMockElement()
      })

      checkSelectedVirtualDevice(context, { acload: { supportsS2: true } })

      expect(mockS2Section.hide).toHaveBeenCalled()
      expect(mockS2Measurement.hide).toHaveBeenCalled()
      expect(mockS2Checkbox.off).not.toHaveBeenCalledWith('change.s2support')
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
        if (selector === '#node-input-default_values-yes') {
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
        if (selector === '#node-input-default_values-yes') {
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
        if (selector === '#node-input-default_values-yes') {
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
        if (selector === '#node-input-default_values-yes') {
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

describe('updateIndicatorLivePreview', () => {
  const PLACEHOLDERS = {
    '#node-input-customname': 'e.g. Solar power',
    '#node-input-primary_label': 'e.g. Power',
    '#node-input-unit': 'e.g. W, kWh, /Temperature'
  }

  function setup (type, { primaryLabel = '', unit = '', customname = '', rangeMin = '', rangeMax = '', decimals = '' } = {}) {
    const mockPreview = { length: 1, html: jest.fn() }
    global.$.mockImplementation((selector) => {
      const vals = {
        '#node-input-indicator_type': String(type),
        '#node-input-primary_label': primaryLabel,
        '#node-input-unit': unit,
        '#node-input-customname': customname,
        '#node-input-range_min': rangeMin,
        '#node-input-range_max': rangeMax,
        '#node-input-decimals': String(decimals)
      }
      if (selector === '#indicator-live-preview') return mockPreview
      if (selector in vals) {
        return {
          val: () => vals[selector],
          attr: (name) => name === 'placeholder' ? (PLACEHOLDERS[selector] || '') : ''
        }
      }
      return createMockElement()
    })
    return mockPreview
  }

  beforeEach(() => { jest.clearAllMocks() })

  test('does nothing when preview element is absent', () => {
    global.$.mockImplementation((selector) => {
      if (selector === '#indicator-live-preview') return { length: 0 }
      return createMockElement()
    })
    expect(() => updateIndicatorLivePreview()).not.toThrow()
  })

  test('renders primary label and unit for type 1 (Value)', () => {
    const mock = setup(1, { primaryLabel: 'Power', unit: 'W' })
    updateIndicatorLivePreview()
    expect(mock.html).toHaveBeenCalled()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Power')
    expect(html).toContain('W')
    expect(html).toContain('21.5')
  })

  test('uses customname for type 2 (Value with range), not primary_label', () => {
    const mock = setup(2, { primaryLabel: 'Power', unit: 'W', customname: 'Solar Panel' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Solar Panel')
    expect(html).not.toContain('Power')
  })

  test('uses customname and °C for type 3 (Temperature), ignores unit field', () => {
    const mock = setup(3, { customname: 'Room Temp', unit: 'ignored' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Room Temp')
    expect(html).toContain('°C')
    expect(html).not.toContain('ignored')
  })

  test('uses placeholder text when primary_label is empty', () => {
    const mock = setup(1, { primaryLabel: '', unit: 'W', customname: 'Solar' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Power')
    expect(html).not.toContain('State')
  })

  test('escapes HTML in label to prevent XSS', () => {
    const mock = setup(1, { primaryLabel: '<script>alert(1)</script>', unit: 'W' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('shows first discrete state for type 0 (Discrete)', () => {
    const mock = setup(0, { primaryLabel: 'Mode', unit: '' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Mode')
    expect(html).not.toContain('21.5')
  })

  test('shows progress bar for type 2 (Value with range)', () => {
    const mock = setup(2, { primaryLabel: 'Power', unit: 'W', customname: 'Solar' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Solar')
    expect(html).toContain('21.5')
    expect(html).toContain('rect')
    // label appears only once (title), not duplicated inside the card
    expect(html.match(/Solar/g).length).toBe(1)
  })

  test('resolves reserved unit to symbol for type 2 (Value with range)', () => {
    const mock = setup(2, { customname: 'Solar', unit: '/Temperature', decimals: '2' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('21.50')
    expect(html).toContain('°C')
    expect(html).not.toContain('/Temperature')
  })

  test('shows progress bar for type 3 (Temperature)', () => {
    const mock = setup(3, { customname: 'Outdoor' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Outdoor')
    expect(html).toContain('°C')
    expect(html).toContain('rect')
  })

  test('formats value with 0 decimals', () => {
    const mock = setup(1, { primaryLabel: 'Power', unit: 'W', decimals: '0' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('22')
    expect(html).not.toContain('21.5')
  })

  test('formats value with 2 decimals', () => {
    const mock = setup(1, { primaryLabel: 'Power', unit: 'W', decimals: '2' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('21.50')
  })

  test('applies decimals to range type value', () => {
    const mock = setup(2, { customname: 'Solar', unit: 'W', decimals: '1' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('21.5')
    expect(html).not.toContain('21.50')
  })

  test('resolves /Temperature to °C in value and Temperature as card label', () => {
    const mock = setup(1, { primaryLabel: 'Room', unit: '/Temperature' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('°C')
    expect(html).toContain('Temperature')
    expect(html).not.toContain('/Temperature')
    expect(html).not.toContain('Room')
  })

  test('uses customname as title and primary_label as card label for type 1', () => {
    const mock = setup(1, { primaryLabel: 'Power', unit: 'W', customname: 'My Sensor' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('My Sensor')
    expect(html).toContain('Power')
  })

  test('uses placeholder text when customname is empty', () => {
    const mock = setup(1, { primaryLabel: 'Power', unit: 'W', customname: '' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Solar power')
    expect(html).toContain('Power')
  })

  test('resolves /Speed to km/h in preview', () => {
    const mock = setup(1, { primaryLabel: 'Wind', unit: '/Speed' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('km/h')
    expect(html).not.toContain('/Speed')
  })

  test('resolves /Volume to L in preview', () => {
    const mock = setup(1, { primaryLabel: 'Tank', unit: '/Volume' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('L')
    expect(html).not.toContain('/Volume')
  })

  test('leaves plain unit unchanged', () => {
    const mock = setup(1, { primaryLabel: 'Power', unit: 'kWh' })
    updateIndicatorLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('kWh')
  })
})

describe('updateSwitchLivePreview', () => {
  const PLACEHOLDERS = {
    '#node-input-switch_1_customname': 'e.g. Name',
    '#node-input-switch_1_group': 'e.g. Group',
    '#node-input-switch_1_unit': 'e.g. %, °C, RPM'
  }

  function setup (type, { customname = '', group = '', unit = '', min = '', max = '', value0 = '', includeMeasurement = false } = {}) {
    const mockPreview = { length: 1, html: jest.fn() }
    const vals = {
      '#node-input-switch_1_type': String(type),
      '#node-input-switch_1_customname': customname,
      '#node-input-switch_1_group': group,
      '#node-input-switch_1_unit': unit,
      '#node-input-switch_1_min': min,
      '#node-input-switch_1_max': max,
      '#node-input-switch_1_value_0': value0
    }
    const checkboxes = {
      '#node-input-switch_1_include_measurement': includeMeasurement
    }
    global.$.mockImplementation((selector) => {
      if (selector === '#switch-live-preview') return mockPreview
      if (selector in vals) {
        return {
          val: () => vals[selector],
          attr: (name) => name === 'placeholder' ? (PLACEHOLDERS[selector] || '') : ''
        }
      }
      if (selector in checkboxes) {
        return { is: () => checkboxes[selector] }
      }
      return createMockElement()
    })
    return mockPreview
  }

  beforeEach(() => { jest.clearAllMocks() })

  test('does nothing when preview element is absent', () => {
    global.$.mockImplementation((selector) => {
      if (selector === '#switch-live-preview') return { length: 0 }
      return createMockElement()
    })
    expect(() => updateSwitchLivePreview()).not.toThrow()
  })

  test('renders group as title and customname as label for Toggle', () => {
    const mock = setup(SWITCH_TYPE_MAP.TOGGLE, { customname: 'Pump', group: 'Irrigation' })
    updateSwitchLivePreview()
    expect(mock.html).toHaveBeenCalled()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Pump')
    expect(html).toContain('Irrigation')
  })

  test('uses placeholder when group is empty', () => {
    const mock = setup(SWITCH_TYPE_MAP.TOGGLE, { customname: 'Light', group: '' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Light')
    expect(html).toContain('Group')
  })

  test('uses placeholder when customname is empty', () => {
    const mock = setup(SWITCH_TYPE_MAP.TOGGLE, { customname: '', group: 'Lights' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('Lights')
    expect(html).toContain('Name')
  })

  test('escapes HTML in fields to prevent XSS', () => {
    const mock = setup(SWITCH_TYPE_MAP.TOGGLE, { customname: '<script>alert(1)</script>', group: 'Test' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('renders SVG for MOMENTARY type', () => {
    const mock = setup(SWITCH_TYPE_MAP.MOMENTARY, { customname: 'Bell', group: 'Entry' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Bell')
    expect(html).toContain('Entry')
  })

  test('renders SVG for DIMMABLE type', () => {
    const mock = setup(SWITCH_TYPE_MAP.DIMMABLE, { customname: 'Dimmer', group: 'Lights' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Dimmer')
  })

  test('renders temperature indicator (°C) for TEMPERATURE_SETPOINT type', () => {
    const mock = setup(SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT, { customname: 'Thermostat', group: 'HVAC', min: '10', max: '30' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('°C')
    expect(html).toContain('Thermostat')
    expect(html).toContain('20.0')
  })

  test('renders setpoint/measurement when includeMeasurement is checked for TEMPERATURE_SETPOINT', () => {
    const mock = setup(SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT, { customname: 'Thermostat', group: 'HVAC', min: '10', max: '30', includeMeasurement: true })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('20.0/19.0')
    expect(html).toContain('°C')
  })

  test('renders step segments for STEPPED type', () => {
    const mock = setup(SWITCH_TYPE_MAP.STEPPED, { customname: 'Fan', group: 'Ventilation', max: '3' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Fan')
    expect(html).toContain('<rect')
    expect(html).toContain('Off')
  })

  test('renders dropdown control for DROPDOWN type', () => {
    const mock = setup(SWITCH_TYPE_MAP.DROPDOWN, { customname: 'Mode', group: 'Settings', value0: 'Eco' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Mode')
    expect(html).toContain('Eco')
  })

  test('renders slider with unit for BASIC_SLIDER type', () => {
    const mock = setup(SWITCH_TYPE_MAP.BASIC_SLIDER, { customname: 'Speed', group: 'Motor', unit: 'RPM' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Speed')
    expect(html).toContain('RPM')
  })

  test('renders numeric control with unit for NUMERIC_INPUT type', () => {
    const mock = setup(SWITCH_TYPE_MAP.NUMERIC_INPUT, { customname: 'Setpoint', group: 'HVAC', unit: '°C' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Setpoint')
    expect(html).toContain('°C')
  })

  test('renders three-state segments for THREE_STATE type', () => {
    const mock = setup(SWITCH_TYPE_MAP.THREE_STATE, { customname: 'Pump', group: 'Pool' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Pump')
    expect(html).toContain('Off')
    expect(html).toContain('On')
    expect(html).toContain('Auto')
  })

  test('renders SVG for BILGE_PUMP type', () => {
    const mock = setup(SWITCH_TYPE_MAP.BILGE_PUMP, { customname: 'Bilge', group: 'Boat' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Bilge')
  })

  test('renders RGB control with Off button and color swatch for RGB_COLOR_WHEEL type', () => {
    const mock = setup(SWITCH_TYPE_MAP.RGB_COLOR_WHEEL, { customname: 'Accent', group: 'Lights' })
    updateSwitchLivePreview()
    const html = mock.html.mock.calls[0][0]
    expect(html).toContain('<svg')
    expect(html).toContain('Accent')
    expect(html).toContain('Off')
    expect(html).toContain('%')
  })
})
