const gridDevice = require('../src/nodes/victron-virtual/device-types/grid')

describe('Grid Device Configuration', () => {
  describe('Properties', () => {
    test('should have basic grid properties', () => {
      expect(gridDevice.properties).toBeDefined()
      expect(gridDevice.properties.Connected).toBeDefined()
      expect(gridDevice.properties.DeviceType).toBeDefined()
      expect(gridDevice.properties.Role).toBeDefined()
      expect(gridDevice.properties['Ac/Power']).toBeDefined()
      expect(gridDevice.properties['Ac/Frequency']).toBeDefined()
      expect(gridDevice.properties['Ac/N/Current']).toBeDefined()
    })

    test('connected property should have correct configuration', () => {
      const connected = gridDevice.properties.Connected
      expect(connected.type).toBe('i')
      expect(connected.value).toBe(1)
      expect(connected.format(1)).toBe(1)
      expect(connected.format(null)).toBe('')
    })

    test('device type and role should have correct defaults', () => {
      const deviceType = gridDevice.properties.DeviceType
      expect(deviceType.type).toBe('i')
      expect(deviceType.value).toBe(71) // Energy meter

      const role = gridDevice.properties.Role
      expect(role.type).toBe('s')
      expect(role.value).toBe('grid')
    })

    test('frequency and power properties should format correctly', () => {
      const frequency = gridDevice.properties['Ac/Frequency']
      expect(frequency.type).toBe('d')
      expect(frequency.format(50.1)).toBe('50.1Hz')
      expect(frequency.format(null)).toBe('')

      const power = gridDevice.properties['Ac/Power']
      expect(power.type).toBe('d')
      expect(power.format(1234.56)).toBe('1234.56W')
      expect(power.format(null)).toBe('')
    })

    test('neutral current should format correctly', () => {
      const nCurrent = gridDevice.properties['Ac/N/Current']
      expect(nCurrent.type).toBe('d')
      expect(nCurrent.format(12.34)).toBe('12.34A')
      expect(nCurrent.format(null)).toBe('')
    })
  })

  describe('Device Configuration', () => {
    test('should configure single-phase grid meter by default', () => {
      const config = {}
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = gridDevice.configure(config, iface, ifaceDesc)

      expect(iface.NrOfPhases).toBe(1)
      expect(result).toBe('Virtual 1-phase grid meter')

      // Check L1 phase properties are created
      expect(iface['Ac/L1/Current']).toBe(0)
      expect(iface['Ac/L1/Power']).toBe(0)
      expect(iface['Ac/L1/Voltage']).toBe(0)
      expect(iface['Ac/L1/Energy/Forward']).toBe(0)
      expect(iface['Ac/L1/Energy/Reverse']).toBe(0)

      // Check properties were added to ifaceDesc
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L1/Power']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L1/Voltage']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L1/Energy/Forward']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L1/Energy/Reverse']).toBeDefined()
    })

    test('should configure three-phase grid meter', () => {
      const config = { grid_nrofphases: 3 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = gridDevice.configure(config, iface, ifaceDesc)

      expect(iface.NrOfPhases).toBe(3)
      expect(result).toBe('Virtual 3-phase grid meter')

      // Check all three phases are created
      const phases = ['L1', 'L2', 'L3']
      const properties = ['Current', 'Power', 'Voltage', 'Energy/Forward', 'Energy/Reverse']

      phases.forEach(phase => {
        properties.forEach(prop => {
          const key = `Ac/${phase}/${prop}`
          expect(iface[key]).toBe(0)
          expect(ifaceDesc.properties[key]).toBeDefined()
          expect(ifaceDesc.properties[key].type).toBe('d')
        })
      })
    })

    test('should handle two-phase configuration', () => {
      const config = { grid_nrofphases: 2 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = gridDevice.configure(config, iface, ifaceDesc)

      expect(iface.NrOfPhases).toBe(2)
      expect(result).toBe('Virtual 2-phase grid meter')

      // Check L1 and L2 are created, but not L3
      expect(iface['Ac/L1/Current']).toBe(0)
      expect(iface['Ac/L2/Current']).toBe(0)
      expect(iface['Ac/L3/Current']).toBeUndefined()
    })

    test('should set default values when enabled', () => {
      const config = { grid_nrofphases: 1, default_values: true }
      const iface = {}
      const ifaceDesc = { properties: {} }

      gridDevice.configure(config, iface, ifaceDesc)

      expect(iface['Ac/Power']).toBe(0)
      expect(iface['Ac/Frequency']).toBe(50)
      expect(iface['Ac/N/Current']).toBe(0)
    })

    test('should not set default values when disabled', () => {
      const config = { grid_nrofphases: 1, default_values: false }
      const iface = {}
      const ifaceDesc = { properties: {} }

      gridDevice.configure(config, iface, ifaceDesc)

      expect(iface['Ac/Power']).toBeUndefined()
      expect(iface['Ac/Frequency']).toBeUndefined()
      expect(iface['Ac/N/Current']).toBeUndefined()
    })

    test('should validate formatting functions for phase properties', () => {
      const config = { grid_nrofphases: 1 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      gridDevice.configure(config, iface, ifaceDesc)

      // Test Current formatting
      const currentProp = ifaceDesc.properties['Ac/L1/Current']
      expect(currentProp.format(15.23)).toBe('15.23A')
      expect(currentProp.format(null)).toBe('')

      // Test Power formatting
      const powerProp = ifaceDesc.properties['Ac/L1/Power']
      expect(powerProp.format(2500.75)).toBe('2500.75W')
      expect(powerProp.format(null)).toBe('')

      // Test Voltage formatting
      const voltageProp = ifaceDesc.properties['Ac/L1/Voltage']
      expect(voltageProp.format(230.1)).toBe('230.10V')
      expect(voltageProp.format(null)).toBe('')

      // Test Energy formatting
      const energyForwardProp = ifaceDesc.properties['Ac/L1/Energy/Forward']
      expect(energyForwardProp.format(123.456)).toBe('123.46kWh')
      expect(energyForwardProp.format(null)).toBe('')

      const energyReverseProp = ifaceDesc.properties['Ac/L1/Energy/Reverse']
      expect(energyReverseProp.format(98.765)).toBe('98.77kWh')
      expect(energyReverseProp.format(null)).toBe('')
    })

    test('should handle string number of phases configuration', () => {
      const config = { grid_nrofphases: '3' }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = gridDevice.configure(config, iface, ifaceDesc)

      expect(iface.NrOfPhases).toBe(3)
      expect(result).toBe('Virtual 3-phase grid meter')
    })

    test('should default to 1 phase when not specified', () => {
      const config = {}
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = gridDevice.configure(config, iface, ifaceDesc)

      expect(iface.NrOfPhases).toBe(1)
      expect(result).toBe('Virtual 1-phase grid meter')
    })

    test('should handle undefined phase configuration', () => {
      const config = { grid_nrofphases: undefined }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = gridDevice.configure(config, iface, ifaceDesc)

      expect(iface.NrOfPhases).toBe(1)
      expect(result).toBe('Virtual 1-phase grid meter')
    })

    test('should create correct number of properties for each phase count', () => {
      const testCases = [
        { phases: 1, expectedCount: 5 }, // 5 properties per phase
        { phases: 2, expectedCount: 10 },
        { phases: 3, expectedCount: 15 }
      ]

      testCases.forEach(({ phases, expectedCount }) => {
        const config = { grid_nrofphases: phases }
        const iface = {}
        const ifaceDesc = { properties: {} }

        gridDevice.configure(config, iface, ifaceDesc)

        // Count phase-specific properties
        const phaseProperties = Object.keys(ifaceDesc.properties).filter(key => 
          key.startsWith('Ac/L') && (key.includes('/Current') || key.includes('/Power') || 
          key.includes('/Voltage') || key.includes('/Energy/'))
        )

        expect(phaseProperties).toHaveLength(expectedCount)
      })
    })

    test('should maintain all properties with correct types', () => {
      const config = { grid_nrofphases: 2 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      gridDevice.configure(config, iface, ifaceDesc)

      // All phase properties should be type 'd' (double/float)
      const phasePropertyKeys = Object.keys(ifaceDesc.properties).filter(key => key.startsWith('Ac/L'))
      
      phasePropertyKeys.forEach(key => {
        expect(ifaceDesc.properties[key].type).toBe('d')
        expect(ifaceDesc.properties[key].format).toBeDefined()
        expect(typeof ifaceDesc.properties[key].format).toBe('function')
      })
    })
  })
})
