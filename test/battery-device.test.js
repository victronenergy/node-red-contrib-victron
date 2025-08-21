const { 
  properties: batteryProperties, 
  configure: configureBatteryDevice
} = require('../src/nodes/victron-virtual/device-types/battery')
const { createIfaceDesc, createIface } = require('../src/nodes/victron-virtual/utils')

describe('Battery Device Configuration', () => {
  describe('Properties', () => {
    test('has all required battery properties', () => {
      expect(batteryProperties).toBeDefined()
      expect(batteryProperties.Capacity).toBeDefined()
      expect(batteryProperties['Dc/0/Current']).toBeDefined()
      expect(batteryProperties['Dc/0/Voltage']).toBeDefined()
      expect(batteryProperties['Dc/0/Power']).toBeDefined()
      expect(batteryProperties['Dc/0/Temperature']).toBeDefined()
      expect(batteryProperties.Soc).toBeDefined()
      expect(batteryProperties.Soh).toBeDefined()
      expect(batteryProperties.ConsumedAmphours).toBeDefined()
      expect(batteryProperties['System/MinCellVoltage']).toBeDefined()
    })

    test('all alarm properties are defined', () => {
      expect(batteryProperties['Alarms/CellImbalance']).toBeDefined()
      expect(batteryProperties['Alarms/HighChargeCurrent']).toBeDefined()
      expect(batteryProperties['Alarms/HighCurrent']).toBeDefined()
      expect(batteryProperties['Alarms/HighTemperature']).toBeDefined()
      expect(batteryProperties['Alarms/HighVoltage']).toBeDefined()
      expect(batteryProperties['Alarms/InternalFailure']).toBeDefined()
      expect(batteryProperties['Alarms/LowSoc']).toBeDefined()
      expect(batteryProperties['Alarms/LowTemperature']).toBeDefined()
      expect(batteryProperties['Alarms/LowVoltage']).toBeDefined()
      expect(batteryProperties['Alarms/StateOfHealth']).toBeDefined()
    })

    test('capacity property has correct format function and is NOT persistent', () => {
      const capacity = batteryProperties.Capacity
      expect(capacity.format).toBeDefined()
      expect(capacity.format(100)).toBe('100.0Ah')
      expect(capacity.format(100.5)).toBe('100.5Ah')
      expect(capacity.format(0)).toBe('0.0Ah')
      expect(capacity.format(null)).toBe('')
      expect(capacity.format(undefined)).toBe('')
      expect(capacity.format('invalid')).toBe('')
      expect(capacity.persist).toBeUndefined() // Should NOT be persistent
    })

    test('capacity property handles edge cases in format function', () => {
      const capacity = batteryProperties.Capacity
      
      // Test the edge cases that might be on uncovered lines
      expect(capacity.format('invalid')).toBe('') // Should hit isNaN check
      expect(capacity.format(NaN)).toBe('') // Should hit isNaN check  
      expect(capacity.format(Infinity)).toBe('InfinityAh') // Edge case
      expect(capacity.format(-50.7)).toBe('-50.7Ah') // Negative number
      expect(capacity.format('')).toBe('0.0Ah') // Empty string
      expect(capacity.format({})).toBe('') // Object
      expect(capacity.format([])).toBe('0.0Ah') // Array
    })

    test('voltage property has correct format function', () => {
      const voltage = batteryProperties['Dc/0/Voltage']
      expect(voltage.format).toBeDefined()
      expect(voltage.format(12.34)).toBe('12.34V')
      expect(voltage.format(0)).toBe('0.00V')
      expect(voltage.format(null)).toBe('')
      expect(voltage.format(undefined)).toBe('')
    })

    test('current property has correct format function', () => {
      const current = batteryProperties['Dc/0/Current']
      expect(current.format).toBeDefined()
      expect(current.format(5.25)).toBe('5.25A')
      expect(current.format(-3.75)).toBe('-3.75A')
      expect(current.format(0)).toBe('0.00A')
      expect(current.format(null)).toBe('')
    })

    test('power property has correct format function', () => {
      const power = batteryProperties['Dc/0/Power']
      expect(power.format).toBeDefined()
      expect(power.format(250.5)).toBe('250.50W')
      expect(power.format(-150.25)).toBe('-150.25W')
      expect(power.format(0)).toBe('0.00W')
      expect(power.format(null)).toBe('')
    })

    test('temperature property has correct format function', () => {
      const temp = batteryProperties['Dc/0/Temperature']
      expect(temp.format).toBeDefined()
      expect(temp.format(25.5)).toBe('25.5C')
      expect(temp.format(-10)).toBe('-10.0C')
      expect(temp.format(0)).toBe('0.0C')
      expect(temp.format(null)).toBe('')
    })

    test('SOC property has correct constraints and IS persistent', () => {
      const soc = batteryProperties.Soc
      expect(soc.min).toBe(0)
      expect(soc.max).toBe(100)
      expect(soc.persist).toBe(15) // Should be persistent with 15s throttle
      expect(soc.format(85.5)).toBe('86%')
      expect(soc.format(0)).toBe('0%')
      expect(soc.format(100)).toBe('100%')
      expect(soc.format(null)).toBe('')
    })

    test('SOH property has correct format function', () => {
      const soh = batteryProperties.Soh
      expect(soh.format(95.5)).toBe('96%')
      expect(soh.format(100)).toBe('100%')
      expect(soh.format(null)).toBe('')
    })

    test('consumed amphours property has correct format function', () => {
      const consumed = batteryProperties.ConsumedAmphours
      expect(consumed.format(25.75)).toBe('25.75Ah')
      expect(consumed.format(0)).toBe('0.00Ah')
      expect(consumed.format(null)).toBe('')
    })

    test('min cell voltage has correct format function', () => {
      const minCell = batteryProperties['System/MinCellVoltage']
      expect(minCell.format(3.256)).toBe('3.256V')
      expect(minCell.format(3.2)).toBe('3.200V')
      expect(minCell.format(null)).toBe('')
    })

    test('error code property has correct format function', () => {
      const error = batteryProperties.ErrorCode
      expect(error.format).toBeDefined()
      expect(error.format(0)).toBe(0)
      expect(error.format(1)).toBe(1)
      expect(error.format(null)).toBe('')
      expect(error.value).toBe(0)
    })

  describe('Alarm Format Function', () => {
    test('alarm format function handles all valid states', () => {
      // Get any alarm property to test the shared format function
      const alarmFormat = batteryProperties['Alarms/HighVoltage'].format
      
      expect(alarmFormat(0)).toBe('OK')
      expect(alarmFormat(1)).toBe('Warning')
      expect(alarmFormat(2)).toBe('Alarm')
    })

    test('alarm format function handles invalid inputs', () => {
      const alarmFormat = batteryProperties['Alarms/HighVoltage'].format
      
      expect(alarmFormat(3)).toBe('unknown')
      expect(alarmFormat(-1)).toBe('unknown')
      expect(alarmFormat(null)).toBe('unknown')
      expect(alarmFormat(undefined)).toBe('unknown')
      expect(alarmFormat('invalid')).toBe('unknown')
      expect(alarmFormat({})).toBe('unknown')
    })

    test('all alarms use the shared format function', () => {
      const alarmKeys = [
        'Alarms/CellImbalance',
        'Alarms/HighChargeCurrent', 
        'Alarms/HighCurrent',
        'Alarms/HighTemperature',
        'Alarms/HighVoltage',
        'Alarms/InternalFailure',
        'Alarms/LowSoc',
        'Alarms/LowTemperature',
        'Alarms/LowVoltage',
        'Alarms/StateOfHealth'
      ]

      // Get the reference format function
      const referenceFormat = batteryProperties['Alarms/HighVoltage'].format

      alarmKeys.forEach(key => {
        const alarm = batteryProperties[key]
        // Test that they all produce the same results for the same inputs
        expect(alarm.format(0)).toBe(referenceFormat(0))
        expect(alarm.format(1)).toBe(referenceFormat(1))
        expect(alarm.format(2)).toBe(referenceFormat(2))
        expect(alarm.format(99)).toBe(referenceFormat(99))
      })
    })
  })
  })

  describe('Utils Functions', () => {
    test('createIfaceDesc creates proper interface description', () => {
      const ifaceDesc = createIfaceDesc(batteryProperties)

      expect(ifaceDesc.Capacity).toBeDefined()
      expect(ifaceDesc['Dc/0/Current']).toBeDefined()
      expect(ifaceDesc.DeviceInstance).toBeDefined()
      expect(ifaceDesc.CustomName).toBeDefined()
      expect(ifaceDesc.Serial).toBeDefined()

      // Check that format functions are preserved
      expect(typeof ifaceDesc.Capacity.format).toBe('function')
      expect(ifaceDesc.Capacity.format(100)).toBe('100.0Ah')
    })

    test('createIface creates proper interface with default values', () => {
      const iface = createIface(batteryProperties)

      expect(iface.emit).toBeDefined()
      expect(typeof iface.emit).toBe('function')

      // Properties with defined values should use them
      expect(iface.Connected).toBe(1)
      expect(iface['Info/ChargeRequest']).toBe(0)

      // Properties without defined values should be null
      expect(iface['Dc/0/Current']).toBe(null)
      expect(iface['Dc/0/Voltage']).toBe(null)
    })

    test('createIfaceDesc handles empty properties gracefully', () => {
      const ifaceDesc = createIfaceDesc(null)
      expect(ifaceDesc).toEqual({})
    })

    test('createIface handles empty properties gracefully', () => {
      const iface = createIface(null)
      expect(iface.emit).toBeDefined()
      expect(typeof iface.emit).toBe('function')
    })

  })

  describe('Battery Configuration', () => {
    let config, iface, ifaceDesc

    beforeEach(() => {
      config = {
        device: 'battery'
      }
      iface = createIface(batteryProperties)
      ifaceDesc = { properties: createIfaceDesc(batteryProperties) }
    })

    test('configures battery capacity when provided as string', () => {
      config.battery_capacity = '150'
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(150)
      expect(text).toBe('Virtual 150.0Ah battery')
    })

    test('configures battery capacity when provided as number', () => {
      config.battery_capacity = 200
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(200)
      expect(text).toBe('Virtual 200.0Ah battery')
    })

    test('configures battery capacity with decimal values', () => {
      config.battery_capacity = '100.5'
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(100.5)
      expect(text).toBe('Virtual 100.5Ah battery')
    })

    test('handles zero capacity', () => {
      config.battery_capacity = '0'
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(0)
      expect(text).toBe('Virtual 0.0Ah battery')
    })

    test('handles non-numeric capacity gracefully', () => {
      config.battery_capacity = 'invalid'
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      // Should not set capacity when invalid
      expect(iface.Capacity).toBe(null) // Default from createIface
      expect(text).toContain('Virtual')
      expect(text).toContain('battery')
    })

    test('handles empty string capacity', () => {
      config.battery_capacity = ''
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(null) // Should remain null since empty string is invalid
      expect(text).toBe('Virtual  battery')
    })

    test('handles null capacity', () => {
      config.battery_capacity = null
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(null)
      expect(text).toBe('Virtual  battery')
    })

    test('handles undefined capacity', () => {
      // Don't set battery_capacity at all
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(null)
      expect(text).toBe('Virtual  battery')
    })

    test('sets default values when requested', () => {
      config.default_values = true
      config.include_battery_temperature = true // Need to enable temperature to test its default value
      
      configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface['Dc/0/Current']).toBe(0)
      expect(iface['Dc/0/Voltage']).toBe(24)
      expect(iface['Dc/0/Power']).toBe(0)
      expect(iface['Dc/0/Temperature']).toBe(25)
      expect(iface.Soc).toBe(80)
      expect(iface.Soh).toBe(100)
      expect(iface['System/MinCellVoltage']).toBe(3.3)
    })

    test('sets default values but excludes temperature when not included', () => {
      config.default_values = true
      // Don't set include_battery_temperature (default excludes temperature)
      
      configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface['Dc/0/Current']).toBe(0)
      expect(iface['Dc/0/Voltage']).toBe(24)
      expect(iface['Dc/0/Power']).toBe(0)
      expect(iface['Dc/0/Temperature']).toBeUndefined() // Should be deleted
      expect(iface.Soc).toBe(80)
      expect(iface.Soh).toBe(100)
      expect(iface['System/MinCellVoltage']).toBe(3.3)
    })

    test('does not set default values when not requested', () => {
      config.default_values = false
      
      configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface['Dc/0/Current']).toBe(null) // Original value from createIface
      expect(iface['Dc/0/Voltage']).toBe(null)
      expect(iface['Dc/0/Power']).toBe(null)
      expect(iface.Soc).toBe(null)
      expect(iface.Soh).toBe(null)
    })

    test('excludes temperature when not included', () => {
      config.include_battery_temperature = false
      
      configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(ifaceDesc.properties['Dc/0/Temperature']).toBeUndefined()
      expect(iface['Dc/0/Temperature']).toBeUndefined()
    })

    test('excludes temperature by default (when not explicitly enabled)', () => {
      // Don't set include_battery_temperature at all (default behavior)
      
      configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(ifaceDesc.properties['Dc/0/Temperature']).toBeUndefined()
      expect(iface['Dc/0/Temperature']).toBeUndefined()
    })

    test('includes temperature when explicitly enabled', () => {
      config.include_battery_temperature = true
      
      configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(ifaceDesc.properties['Dc/0/Temperature']).toBeDefined()
      expect(iface['Dc/0/Temperature']).toBeDefined()
    })

    test('updates capacity correctly when configuration changes', () => {
      // Simulate initial deployment with 100Ah capacity
      config.battery_capacity = '100'
      let text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(100)
      expect(text).toBe('Virtual 100.0Ah battery')
      
      // Simulate redeployment with changed capacity (150Ah)
      config.battery_capacity = '150'
      text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(150)
      expect(text).toBe('Virtual 150.0Ah battery')
    })

    test('handles capacity change from undefined to value', () => {
      // Initial deployment without capacity
      delete config.battery_capacity
      let text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(null) // Default from createIface
      expect(text).toBe('Virtual  battery')
      
      // Redeploy with capacity added
      config.battery_capacity = '200'
      text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(200)
      expect(text).toBe('Virtual 200.0Ah battery')
    })

    test('handles missing capacity in display text', () => {
      // No capacity configured
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(text).toBe('Virtual  battery')
    })

    test('works with both temperature included and default values', () => {
      config.include_battery_temperature = true
      config.default_values = true
      config.battery_capacity = '75'
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(75)
      expect(iface['Dc/0/Temperature']).toBe(25)
      expect(ifaceDesc.properties['Dc/0/Temperature']).toBeDefined()
      expect(text).toBe('Virtual 75.0Ah battery')
    })

    test('works with temperature excluded but default values enabled', () => {
      config.include_battery_temperature = false
      config.default_values = true
      config.battery_capacity = '125'
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(125)
      expect(iface['Dc/0/Temperature']).toBeUndefined()
      expect(ifaceDesc.properties['Dc/0/Temperature']).toBeUndefined()
      expect(iface['Dc/0/Voltage']).toBe(24) // Other defaults should still work
      expect(text).toBe('Virtual 125.0Ah battery')
    })

    test('handles edge cases in capacity configuration', () => {
      // Test potential uncovered lines in configuration logic
      const testCases = [
        { capacity: 0, expected: 0, text: 'Virtual 0.0Ah battery' },
        { capacity: '0.0', expected: 0, text: 'Virtual 0.0Ah battery' },
        { capacity: null, expected: null, text: 'Virtual  battery' },
        { capacity: undefined, expected: null, text: 'Virtual  battery' }
      ]

      testCases.forEach(({ capacity, expected, text: expectedText }) => {
        const testConfig = { battery_capacity: capacity }
        const testIface = createIface(batteryProperties)
        const testIfaceDesc = { properties: createIfaceDesc(batteryProperties) }
        
        const result = configureBatteryDevice(testConfig, testIface, testIfaceDesc)
        
        expect(testIface.Capacity).toBe(expected)
        expect(result).toBe(expectedText)
      })
    })

    test('handles format function edge cases', () => {
      // Test edge cases that might be on uncovered lines
      const testValues = [
        { input: '', expected: '0.0Ah' },
        { input: '  ', expected: '0.0Ah' },
        { input: 'not-a-number', expected: '' },
        { input: '123.456abc', expected: '' }, // Invalid number
        { input: Number.POSITIVE_INFINITY, expected: 'InfinityAh' },
        { input: Number.NEGATIVE_INFINITY, expected: '-InfinityAh' }
      ]

      testValues.forEach(({ input, expected }) => {
        const result = batteryProperties.Capacity.format(input)
        expect(result).toBe(expected)
      })
    })
  })
})

describe('Battery voltage selection', () => {
  test('should use 12V when selected and default_values enabled', () => {
    const config = {
      default_values: true,
      battery_voltage_preset: '12'
    }
    const iface = createIface(batteryProperties)
    const ifaceDesc = { properties: { ...batteryProperties } }

    configureBatteryDevice(config, iface, ifaceDesc)

    expect(iface['Dc/0/Voltage']).toBe(12)
  })

  test('should use 24V when selected and default_values enabled', () => {
    const config = {
      default_values: true,
      battery_voltage_preset: '24'
    }
    const iface = createIface(batteryProperties)
    const ifaceDesc = { properties: { ...batteryProperties } }

    configureBatteryDevice(config, iface, ifaceDesc)

    expect(iface['Dc/0/Voltage']).toBe(24)
  })

  test('should use 48V when selected and default_values enabled', () => {
    const config = {
      default_values: true,
      battery_voltage_preset: '48'
    }
    const iface = createIface(batteryProperties)
    const ifaceDesc = { properties: { ...batteryProperties } }

    configureBatteryDevice(config, iface, ifaceDesc)

    expect(iface['Dc/0/Voltage']).toBe(48)
  })

  test('should use custom voltage when selected and default_values enabled', () => {
    const config = {
      default_values: true,
      battery_voltage_preset: 'custom',
      battery_voltage_custom: 36.5
    }
    const iface = createIface(batteryProperties)
    const ifaceDesc = { properties: { ...batteryProperties } }

    configureBatteryDevice(config, iface, ifaceDesc)

    expect(iface['Dc/0/Voltage']).toBe(36.5)
  })

  test('should fallback to 24V when custom selected but no custom value provided', () => {
    const config = {
      default_values: true,
      battery_voltage_preset: 'custom'
      // battery_voltage_custom not provided
    }
    const iface = createIface(batteryProperties)
    const ifaceDesc = { properties: { ...batteryProperties } }

    configureBatteryDevice(config, iface, ifaceDesc)

    expect(iface['Dc/0/Voltage']).toBe(24)
  })

  test('should fallback to 24V when invalid preset provided', () => {
    const config = {
      default_values: true,
      battery_voltage_preset: 'invalid'
    }
    const iface = createIface(batteryProperties)
    const ifaceDesc = { properties: { ...batteryProperties } }

    configureBatteryDevice(config, iface, ifaceDesc)

    expect(iface['Dc/0/Voltage']).toBe(24)
  })

  test('should not set voltage when default_values is false', () => {
    const config = {
      default_values: false,
      battery_voltage_preset: '12'
    }
    const iface = createIface(batteryProperties)
    const ifaceDesc = { properties: { ...batteryProperties } }

    configureBatteryDevice(config, iface, ifaceDesc)

    expect(iface['Dc/0/Voltage']).toBe(null)
  })
})
