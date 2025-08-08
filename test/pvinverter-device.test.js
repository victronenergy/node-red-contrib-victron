const pvinverterDevice = require('../src/nodes/victron-virtual/device-types/pvinverter')

describe('PV Inverter Device Configuration', () => {
  describe('Properties', () => {
    test('should have core AC properties', () => {
      const props = pvinverterDevice.properties
      
      expect(props['Ac/Energy/Forward']).toBeDefined()
      expect(props['Ac/Power']).toBeDefined()
      expect(props['Ac/MaxPower']).toBeDefined()
      expect(props['Ac/PowerLimit']).toBeDefined()
      expect(props.Connected).toBeDefined()
    })

    test('should have status and control properties', () => {
      const props = pvinverterDevice.properties
      
      expect(props.ErrorCode).toBeDefined()
      expect(props.Position).toBeDefined()
      expect(props.StatusCode).toBeDefined()
      expect(props.NrOfPhases).toBeDefined()
    })

    test('position should have correct enum values', () => {
      const position = pvinverterDevice.properties.Position
      
      expect(position.format(0)).toBe('AC input 1')
      expect(position.format(1)).toBe('AC output')
      expect(position.format(2)).toBe('AC input 2')
      expect(position.format(99)).toBe('unknown')
    })

    test('status code should have correct enum values', () => {
      const status = pvinverterDevice.properties.StatusCode
      
      expect(status.format(0)).toBe('Startup 0')
      expect(status.format(7)).toBe('Running')
      expect(status.format(8)).toBe('Standby')
      expect(status.format(10)).toBe('Error')
      expect(status.format(11)).toBe('Running (MPPT)')
      expect(status.format(12)).toBe('Running (Throttled)')
      expect(status.format(99)).toBe('unknown')
    })

    test('error code should format correctly', () => {
      const error = pvinverterDevice.properties.ErrorCode
      
      expect(error.format(0)).toBe('No error')
      expect(error.format(1)).toBe('unknown')
      expect(error.value).toBe(0)
    })

    test('power properties should format with correct units', () => {
      const power = pvinverterDevice.properties['Ac/Power']
      const maxPower = pvinverterDevice.properties['Ac/MaxPower']
      const powerLimit = pvinverterDevice.properties['Ac/PowerLimit']
      
      expect(power.format(1500.5)).toBe('1500.50W')
      expect(maxPower.format(3000)).toBe('3000.00W')
      expect(powerLimit.format(2500.25)).toBe('2500.25W')
      expect(power.format(null)).toBe('')
    })

    test('energy should format correctly', () => {
      const energy = pvinverterDevice.properties['Ac/Energy/Forward']
      
      expect(energy.format(125.75)).toBe('125.75kWh')
      expect(energy.format(0)).toBe('0.00kWh')
      expect(energy.format(null)).toBe('')
    })
  })

  describe('Configuration Function', () => {
    test('configures single-phase pvinverter by default', () => {
      const config = {}
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = pvinverterDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual 1-phase pvinverter')
      expect(iface.Position).toBe(0)
      expect(iface.NrOfPhases).toBe(1)
    })

    test('configures three-phase pvinverter', () => {
      const config = { pvinverter_nrofphases: '3' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = pvinverterDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual 3-phase pvinverter')
      expect(iface.NrOfPhases).toBe(3)
    })

    test('sets position from config', () => {
      const config = { position: '2' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      pvinverterDevice.configure(config, iface, ifaceDesc)

      expect(iface.Position).toBe(2)
    })

    test('creates AC phase properties for single phase', () => {
      const config = { pvinverter_nrofphases: '1' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      pvinverterDevice.configure(config, iface, ifaceDesc)

      // Check L1 properties are created
      expect(iface['Ac/L1/Current']).toBe(0)
      expect(iface['Ac/L1/Power']).toBe(0)
      expect(iface['Ac/L1/Voltage']).toBe(0)
      expect(iface['Ac/L1/Energy/Forward']).toBe(0)

      // Check property descriptions are created
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L1/Current'].type).toBe('d')
      expect(ifaceDesc.properties['Ac/L1/Current'].format(5.25)).toBe('5.25A')

      // Check L2 properties are NOT created
      expect(iface['Ac/L2/Current']).toBeUndefined()
    })

    test('creates AC phase properties for three phases', () => {
      const config = { pvinverter_nrofphases: '3' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      pvinverterDevice.configure(config, iface, ifaceDesc)

      // Check all phases are created
      const phases = ['L1', 'L2', 'L3']
      const properties = ['Current', 'Power', 'Voltage', 'Energy/Forward']

      phases.forEach(phase => {
        properties.forEach(prop => {
          const key = `Ac/${phase}/${prop}`
          expect(iface[key]).toBe(0)
          expect(ifaceDesc.properties[key]).toBeDefined()
        })
      })
    })

    test('sets default values when enabled', () => {
      const config = {
        default_values: true,
        pvinverter_nrofphases: '1',
        position: '1'
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      pvinverterDevice.configure(config, iface, ifaceDesc)

      expect(iface['Ac/Power']).toBe(0)
      expect(iface['Ac/MaxPower']).toBe(1000)
      expect(iface['Ac/PowerLimit']).toBe(1000)
      expect(iface['Ac/Energy/Forward']).toBe(0)
      expect(iface.ErrorCode).toBe(0)
      expect(iface.StatusCode).toBe(0)
    })

    test('does not set default values when disabled', () => {
      const config = {
        default_values: false,
        pvinverter_nrofphases: '1'
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      pvinverterDevice.configure(config, iface, ifaceDesc)

      // These should not be set when default_values is false
      expect(iface['Ac/Power']).toBeUndefined()
      expect(iface['Ac/MaxPower']).toBeUndefined()
      expect(iface['Ac/PowerLimit']).toBeUndefined()
      
      // But position and phases should still be set
      expect(iface.Position).toBe(0)
      expect(iface.NrOfPhases).toBe(1)
    })

    test('handles invalid phase numbers gracefully', () => {
      const config = { pvinverter_nrofphases: 'invalid' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = pvinverterDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual NaN-phase pvinverter')
      expect(iface.NrOfPhases).toBeNaN()
    })

    test('validates phase property formatting', () => {
      const config = { pvinverter_nrofphases: '2' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      pvinverterDevice.configure(config, iface, ifaceDesc)

      // Test formatting functions work correctly
      expect(ifaceDesc.properties['Ac/L1/Current'].format(12.34)).toBe('12.34A')
      expect(ifaceDesc.properties['Ac/L1/Power'].format(2500)).toBe('2500.00W')
      expect(ifaceDesc.properties['Ac/L1/Voltage'].format(230.5)).toBe('230.50V')
      expect(ifaceDesc.properties['Ac/L1/Energy/Forward'].format(45.67)).toBe('45.67kWh')
    })
  })
})
