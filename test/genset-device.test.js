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
