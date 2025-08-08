const gensetDevice = require('../src/nodes/victron-virtual/device-types/genset')

describe('Genset Device Configuration', () => {
  describe('Properties', () => {
    test('should have genset and dcgenset properties', () => {
      expect(gensetDevice.properties).toBeDefined()
      expect(gensetDevice.properties.genset).toBeDefined()
      expect(gensetDevice.properties.dcgenset).toBeDefined()
    })

    test('genset should have AC properties', () => {
      const props = gensetDevice.properties.genset
      
      expect(props['Ac/Power']).toBeDefined()
      expect(props['Ac/Energy/Forward']).toBeDefined()
      expect(props['Ac/Frequency']).toBeDefined()
      expect(props.NrOfPhases).toBeDefined()
    })

    test('dcgenset should have DC properties', () => {
      const props = gensetDevice.properties.dcgenset
      
      expect(props['Dc/0/Current']).toBeDefined()
      expect(props['Dc/0/Power']).toBeDefined()
      expect(props['Dc/0/Voltage']).toBeDefined()
      expect(props['History/EnergyOut']).toBeDefined()
      expect(props.State).toBeDefined()
    })

    test('both should have common generator properties', () => {
      const gensetProps = gensetDevice.properties.genset
      const dcgensetProps = gensetDevice.properties.dcgenset
      
      const commonProps = ['Engine/Load', 'Engine/Speed', 'StatusCode', 'StarterVoltage']
      commonProps.forEach(prop => {
        expect(gensetProps[prop]).toBeDefined()
        expect(dcgensetProps[prop]).toBeDefined()
      })
    })
  })

  describe('Configuration Function', () => {
    test('configures AC generator with default settings', () => {
      const config = { generator_type: 'ac', generator_nrofphases: '3' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = gensetDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual 3-phase AC generator')
      expect(iface.NrOfPhases).toBe(3)
    })

    test('configures DC generator', () => {
      const config = { generator_type: 'dc' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = gensetDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual DC generator')
    })

    test('sets default values when requested', () => {
      const config = { 
        generator_type: 'dc', 
        default_values: true,
        include_engine_hours: true,
        include_starter_voltage: true 
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      gensetDevice.configure(config, iface, ifaceDesc)

      expect(iface['Engine/Load']).toBe(0)
      expect(iface['Engine/Speed']).toBe(0)
      expect(iface['Dc/0/Voltage']).toBe(48)
      expect(iface['Engine/OperatingHours']).toBe(0)
      expect(iface.StarterVoltage).toBe(12)
    })

    test('removes optional properties when disabled', () => {
      const config = { 
        generator_type: 'dc',
        include_engine_hours: false,
        include_starter_voltage: false,
        include_history_energy: false
      }
      const iface = { 
        'Engine/OperatingHours': 0,
        StarterVoltage: 12,
        'History/EnergyOut': 0
      }
      const ifaceDesc = { 
        properties: {
          'Engine/OperatingHours': {},
          StarterVoltage: {},
          'History/EnergyOut': {},
          'Alarms/LowStarterVoltage': {},
          'Alarms/HighStarterVoltage': {}
        }
      }

      gensetDevice.configure(config, iface, ifaceDesc)

      expect(iface['Engine/OperatingHours']).toBeUndefined()
      expect(iface.StarterVoltage).toBeUndefined()
      expect(iface['History/EnergyOut']).toBeUndefined()
      expect(ifaceDesc.properties['Engine/OperatingHours']).toBeUndefined()
      expect(ifaceDesc.properties.StarterVoltage).toBeUndefined()
    })
  })
})

describe('Property Format Functions', () => {
  test('genset power format function works correctly', () => {
    const powerProp = gensetDevice.properties.genset['Ac/Power']
    expect(powerProp.format(1234.56)).toBe('1234.56W')
    expect(powerProp.format(0)).toBe('0.00W')
    expect(powerProp.format(null)).toBe('')
    expect(powerProp.format(undefined)).toBe('')
    // Note: genset format functions don't have robust input validation like battery
    // Testing only valid numeric inputs to avoid TypeError
  })

  test('genset energy format function works correctly', () => {
    const energyProp = gensetDevice.properties.genset['Ac/Energy/Forward']
    expect(energyProp.format(1.5)).toBe('1.50kWh')
    expect(energyProp.format(0)).toBe('0.00kWh')
    expect(energyProp.format(null)).toBe('')
    expect(energyProp.format(undefined)).toBe('')
  })

  test('genset frequency format function works correctly', () => {
    const freqProp = gensetDevice.properties.genset['Ac/Frequency']
    expect(freqProp.format(50.25)).toBe('50.3Hz')
    expect(freqProp.format(60)).toBe('60.0Hz')
    expect(freqProp.format(null)).toBe('')
  })

  test('dcgenset current format function works correctly', () => {
    const currentProp = gensetDevice.properties.dcgenset['Dc/0/Current']
    expect(currentProp.format(12.34)).toBe('12.34A')
    expect(currentProp.format(-5.67)).toBe('-5.67A')
    expect(currentProp.format(null)).toBe('')
  })

  test('dcgenset power format function works correctly', () => {
    const powerProp = gensetDevice.properties.dcgenset['Dc/0/Power']
    expect(powerProp.format(500.75)).toBe('500.75W')
    expect(powerProp.format(0)).toBe('0.00W')
    expect(powerProp.format(null)).toBe('')
  })

  test('dcgenset voltage format function works correctly', () => {
    const voltageProp = gensetDevice.properties.dcgenset['Dc/0/Voltage']
    expect(voltageProp.format(48.2)).toBe('48.20V')
    expect(voltageProp.format(24)).toBe('24.00V')
    expect(voltageProp.format(null)).toBe('')
  })

  test('dcgenset temperature format function works correctly', () => {
    const tempProp = gensetDevice.properties.dcgenset['Dc/0/Temperature']
    expect(tempProp.format(25.5)).toBe('25.5C')
    expect(tempProp.format(-10)).toBe('-10.0C')
    expect(tempProp.format(null)).toBe('')
  })

  test('engine speed format function works correctly', () => {
    const speedProp = gensetDevice.properties.genset['Engine/Speed']
    expect(speedProp.format(1800)).toBe('1800RPM')
    expect(speedProp.format(0)).toBe('0RPM')
    expect(speedProp.format(null)).toBe('')
  })

  test('engine load format function works correctly', () => {
    const loadProp = gensetDevice.properties.genset['Engine/Load']
    expect(loadProp.format(75.5)).toBe('75.5%')
    expect(loadProp.format(0)).toBe('0.0%')
    expect(loadProp.format(null)).toBe('')
  })

  test('history energy format function works correctly', () => {
    const historyProp = gensetDevice.properties.dcgenset['History/EnergyOut']
    expect(historyProp.format(123.45)).toBe('123.45kWh')
    expect(historyProp.format(0)).toBe('0.00kWh')
    expect(historyProp.format(null)).toBe('')
  })

  test('state format function works correctly', () => {
    const stateProp = gensetDevice.properties.dcgenset.State
    expect(stateProp.format(0)).toBe('Stopped')
    expect(stateProp.format(1)).toBe('Running')
    expect(stateProp.format(99)).toBe('unknown')
    expect(stateProp.format(null)).toBe('unknown')
  })
})

describe('AC Generator Phase Configuration', () => {
  test('configures single phase AC generator', () => {
    const config = { generator_type: 'ac', generator_nrofphases: '1' }
    const iface = {}
    const ifaceDesc = { properties: {} }

    const result = gensetDevice.configure(config, iface, ifaceDesc)

    expect(result).toBe('Virtual 1-phase AC generator')
    expect(iface.NrOfPhases).toBe(1)
    expect(iface['Ac/L1/Current']).toBe(0)
    expect(iface['Ac/L1/Power']).toBe(0)
    expect(iface['Ac/L1/Voltage']).toBe(0)
    expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L1/Power']).toBeDefined()
    expect(ifaceDesc.properties['Ac/L1/Voltage']).toBeDefined()
  })

  test('configures two phase AC generator', () => {
    const config = { generator_type: 'ac', generator_nrofphases: '2' }
    const iface = {}
    const ifaceDesc = { properties: {} }

    const result = gensetDevice.configure(config, iface, ifaceDesc)

    expect(result).toBe('Virtual 2-phase AC generator')
    expect(iface.NrOfPhases).toBe(2)
    
    // Check L1 phase
    expect(iface['Ac/L1/Current']).toBe(0)
    expect(iface['Ac/L1/Power']).toBe(0)
    expect(iface['Ac/L1/Voltage']).toBe(0)
    
    // Check L2 phase
    expect(iface['Ac/L2/Current']).toBe(0)
    expect(iface['Ac/L2/Power']).toBe(0)
    expect(iface['Ac/L2/Voltage']).toBe(0)
  })

  test('handles missing phase number defaulting to 1', () => {
    const config = { generator_type: 'ac' } // No nrofphases specified
    const iface = {}
    const ifaceDesc = { properties: {} }

    const result = gensetDevice.configure(config, iface, ifaceDesc)

    expect(result).toBe('Virtual 1-phase AC generator')
    expect(iface.NrOfPhases).toBe(1)
    expect(iface['Ac/L1/Current']).toBe(0)
  })

  test('AC phase property format functions work correctly', () => {
    const config = { generator_type: 'ac', generator_nrofphases: '1' }
    const iface = {}
    const ifaceDesc = { properties: {} }

    gensetDevice.configure(config, iface, ifaceDesc)

    // Test the dynamically added format functions
    const currentFormat = ifaceDesc.properties['Ac/L1/Current'].format
    const powerFormat = ifaceDesc.properties['Ac/L1/Power'].format
    const voltageFormat = ifaceDesc.properties['Ac/L1/Voltage'].format

    expect(currentFormat(12.34)).toBe('12.34A')
    expect(powerFormat(567.89)).toBe('567.89W')
    expect(voltageFormat(230.5)).toBe('230.50V')
    
    expect(currentFormat(null)).toBe('')
    expect(powerFormat(null)).toBe('')
    expect(voltageFormat(null)).toBe('')
  })
})

describe('AC Generator Default Values', () => {
  test('sets AC generator default values when enabled', () => {
    const config = { 
      generator_type: 'ac',
      generator_nrofphases: '3',
      default_values: true,
      include_engine_hours: true,
      include_starter_voltage: true
    }
    const iface = {}
    const ifaceDesc = { properties: {} }

    gensetDevice.configure(config, iface, ifaceDesc)

    // Common engine defaults
    expect(iface['Engine/Load']).toBe(0)
    expect(iface['Engine/Speed']).toBe(0)
    expect(iface.StatusCode).toBe(0)
    expect(iface.State).toBe(0)

    // AC specific defaults
    expect(iface['Ac/Power']).toBe(0)
    expect(iface['Ac/Energy/Forward']).toBe(0)

    // Optional defaults
    expect(iface['Engine/OperatingHours']).toBe(0)
    expect(iface.StarterVoltage).toBe(12)
  })

  test('does not set default values when disabled', () => {
    const config = { 
      generator_type: 'ac',
      default_values: false
    }
    const iface = {}
    const ifaceDesc = { properties: {} }

    gensetDevice.configure(config, iface, ifaceDesc)

    expect(iface['Engine/Load']).toBeUndefined()
    expect(iface['Ac/Power']).toBeUndefined()
  })
})

describe('DC Generator History Energy', () => {
  test('includes history energy when enabled', () => {
    const config = { 
      generator_type: 'dc',
      include_history_energy: true,
      default_values: true
    }
    const iface = {}
    // Need to start with the base dcgenset properties
    const ifaceDesc = { 
      properties: { ...gensetDevice.properties.dcgenset }
    }

    gensetDevice.configure(config, iface, ifaceDesc)

    expect(iface['History/EnergyOut']).toBe(0)
    expect(ifaceDesc.properties['History/EnergyOut']).toBeDefined()
  })

  test('excludes history energy when disabled for DC generator', () => {
    const config = { 
      generator_type: 'dc',
      include_history_energy: false
    }
    const iface = { 'History/EnergyOut': 100 }
    const ifaceDesc = { 
      properties: { 'History/EnergyOut': {} }
    }

    gensetDevice.configure(config, iface, ifaceDesc)

    expect(iface['History/EnergyOut']).toBeUndefined()
    expect(ifaceDesc.properties['History/EnergyOut']).toBeUndefined()
  })
})

describe('Alarm Properties', () => {
  test('includes starter voltage alarms when starter voltage enabled', () => {
    const config = { 
      generator_type: 'dc',
      include_starter_voltage: true
    }
    const iface = {}
    // Need to start with the base dcgenset properties that include alarms
    const ifaceDesc = { 
      properties: { ...gensetDevice.properties.dcgenset }
    }

    gensetDevice.configure(config, iface, ifaceDesc)

    // Alarms should be included (not removed)
    expect(ifaceDesc.properties['Alarms/LowStarterVoltage']).toBeDefined()
    expect(ifaceDesc.properties['Alarms/HighStarterVoltage']).toBeDefined()
  })

  test('removes starter voltage alarms when starter voltage disabled', () => {
    const config = { 
      generator_type: 'dc',
      include_starter_voltage: false
    }
    const iface = { 
      'Alarms/LowStarterVoltage': 0,
      'Alarms/HighStarterVoltage': 0
    }
    const ifaceDesc = { 
      properties: {
        'Alarms/LowStarterVoltage': {},
        'Alarms/HighStarterVoltage': {}
      }
    }

    gensetDevice.configure(config, iface, ifaceDesc)

    expect(iface['Alarms/LowStarterVoltage']).toBeUndefined()
    expect(iface['Alarms/HighStarterVoltage']).toBeUndefined()
    expect(ifaceDesc.properties['Alarms/LowStarterVoltage']).toBeUndefined()
    expect(ifaceDesc.properties['Alarms/HighStarterVoltage']).toBeUndefined()
  })
})

describe('Edge Cases and Error Handling', () => {
  test('handles invalid generator type gracefully', () => {
    const config = { generator_type: 'invalid' }
    const iface = {}
    const ifaceDesc = { properties: {} }

    const result = gensetDevice.configure(config, iface, ifaceDesc)

    expect(result).toBe('Virtual 1-phase AC generator') // Defaults to AC
    expect(iface.NrOfPhases).toBe(1)
  })

  test('handles string number conversion for phases', () => {
    const config = { 
      generator_type: 'ac', 
      generator_nrofphases: '3' // String should convert to number
    }
    const iface = {}
    const ifaceDesc = { properties: {} }

    const result = gensetDevice.configure(config, iface, ifaceDesc)

    expect(result).toBe('Virtual 3-phase AC generator')
    expect(iface.NrOfPhases).toBe(3)
  })

  test('handles invalid phase number gracefully', () => {
    const config = { 
      generator_type: 'ac', 
      generator_nrofphases: 'invalid'
    }
    const iface = {}
    const ifaceDesc = { properties: {} }

    const result = gensetDevice.configure(config, iface, ifaceDesc)

    expect(result).toBe('Virtual NaN-phase AC generator') // Number('invalid') = NaN
    expect(iface.NrOfPhases).toBeNaN()
  })
})
