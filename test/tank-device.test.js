const tankDevice = require('../src/nodes/victron-virtual/device-types/tank')

describe('Tank Device Configuration', () => {
  describe('Properties', () => {
    test('should have all required tank properties', () => {
      expect(tankDevice.properties).toBeDefined()
      expect(tankDevice.properties.FluidType).toBeDefined()
      expect(tankDevice.properties.Level).toBeDefined()
      expect(tankDevice.properties.Capacity).toBeDefined()
      expect(tankDevice.properties.Temperature).toBeDefined()
      expect(tankDevice.properties.BatteryVoltage).toBeDefined()
      expect(tankDevice.properties.Status).toBeDefined()
      expect(tankDevice.properties.Remaining).toBeDefined()
    })

    test('fluid type should have correct enum formatting', () => {
      const fluidType = tankDevice.properties.FluidType
      expect(fluidType.type).toBe('i')
      expect(fluidType.value).toBe(0) // Default to Fuel
      expect(fluidType.persist).toBe(true)
      
      expect(fluidType.format(0)).toBe('Fuel')
      expect(fluidType.format(1)).toBe('Fresh water')
      expect(fluidType.format(2)).toBe('Waste water')
      expect(fluidType.format(3)).toBe('Live well')
      expect(fluidType.format(4)).toBe('Oil')
      expect(fluidType.format(5)).toBe('Black water (sewage)')
      expect(fluidType.format(6)).toBe('Gasoline')
      expect(fluidType.format(7)).toBe('Diesel')
      expect(fluidType.format(8)).toBe('LPG')
      expect(fluidType.format(9)).toBe('LNG')
      expect(fluidType.format(10)).toBe('Hydraulic oil')
      expect(fluidType.format(11)).toBe('Raw water')
      expect(fluidType.format(99)).toBe('unknown')
    })

    test('level property should format as percentage with persistence', () => {
      const level = tankDevice.properties.Level
      expect(level.type).toBe('d')
      expect(level.format(75.5)).toBe('76%') // Should round to nearest integer
      expect(level.format(null)).toBe('')
      expect(level.persist).toBe(60) // 60 second persistence
    })

    test('capacity property should format as cubic meters', () => {
      const capacity = tankDevice.properties.Capacity
      expect(capacity.type).toBe('d')
      expect(capacity.format(0.25)).toBe('0.25m3')
      expect(capacity.format(null)).toBe('')
    })

    test('temperature property should format with persistence', () => {
      const temperature = tankDevice.properties.Temperature
      expect(temperature.type).toBe('d')
      expect(temperature.format(25.6)).toBe('25.6C')
      expect(temperature.format(null)).toBe('')
      expect(temperature.persist).toBe(60)
    })

    test('battery voltage should have default value', () => {
      const batteryVoltage = tankDevice.properties.BatteryVoltage
      expect(batteryVoltage.type).toBe('d')
      expect(batteryVoltage.value).toBe(3.3)
      expect(batteryVoltage.format(3.25)).toBe('3.25V')
      expect(batteryVoltage.format(null)).toBe('')
    })

    test('should have all alarm properties', () => {
      const alarmProperties = [
        'Alarms/High/Active',
        'Alarms/High/Delay', 
        'Alarms/High/Enable',
        'Alarms/High/Restore',
        'Alarms/High/State',
        'Alarms/Low/Active',
        'Alarms/Low/Delay',
        'Alarms/Low/Enable', 
        'Alarms/Low/Restore',
        'Alarms/Low/State'
      ]

      alarmProperties.forEach(prop => {
        expect(tankDevice.properties[prop]).toBeDefined()
        expect(tankDevice.properties[prop].type).toBe('d')
      })
    })

    test('should have raw sensor properties', () => {
      const rawProperties = ['RawUnit', 'RawValue', 'RawValueEmpty', 'RawValueFull', 'Shape']
      
      rawProperties.forEach(prop => {
        expect(tankDevice.properties[prop]).toBeDefined()
      })

      expect(tankDevice.properties.RawUnit.type).toBe('s')
      expect(tankDevice.properties.RawUnit.persist).toBe(true)
      expect(tankDevice.properties.RawValueEmpty.persist).toBe(true)
      expect(tankDevice.properties.RawValueFull.persist).toBe(true)
      expect(tankDevice.properties.Shape.persist).toBe(true)
    })
  })

  describe('Device Configuration', () => {
    test('should configure tank with fresh water as default', () => {
      const config = {}
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      const result = tankDevice.configure(config, iface, ifaceDesc)

      expect(iface.FluidType).toBe(1) // Fresh water (config default)
      expect(result).toBe('Virtual fresh water tank')
    })

    test('should set fluid type from configuration', () => {
      const config = { fluid_type: 0 } // Fuel
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      const result = tankDevice.configure(config, iface, ifaceDesc)

      expect(iface.FluidType).toBe(0)
      expect(result).toBe('Virtual fuel tank')
    })

    test('should set capacity from configuration', () => {
      const config = { tank_capacity: 0.5 }
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      tankDevice.configure(config, iface, ifaceDesc)

      expect(iface.Capacity).toBe(0.5)
    })

    test('should set default values when enabled', () => {
      const config = { default_values: true, fluid_type: 1 }
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      tankDevice.configure(config, iface, ifaceDesc)

      expect(iface.Level).toBe(50)
      expect(iface.Temperature).toBe(25)
    })

    test('should not set default values when disabled', () => {
      const config = { default_values: false, fluid_type: 1 }
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      tankDevice.configure(config, iface, ifaceDesc)

      expect(iface.Level).toBeUndefined()
      expect(iface.Temperature).toBeUndefined()
    })

    test('should remove battery voltage when not included', () => {
      const config = { include_tank_battery: false }
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      tankDevice.configure(config, iface, ifaceDesc)

      expect(ifaceDesc.properties.BatteryVoltage).toBeUndefined()
      expect(iface.BatteryVoltage).toBeUndefined()
    })

    test('should set battery voltage when included', () => {
      const config = { 
        include_tank_battery: true,
        tank_battery_voltage: 3.6
      }
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      tankDevice.configure(config, iface, ifaceDesc)

      expect(iface.BatteryVoltage).toBe(3.6)
      expect(ifaceDesc.properties.BatteryVoltage).toBeDefined()
    })

    test('should remove temperature when not included', () => {
      const config = { include_tank_temperature: false }
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      tankDevice.configure(config, iface, ifaceDesc)

      expect(ifaceDesc.properties.Temperature).toBeUndefined()
      expect(iface.Temperature).toBeUndefined()
    })

    test('should handle all fluid types for display text', () => {
      const testCases = [
        { type: 0, expected: 'Virtual fuel tank' },
        { type: 1, expected: 'Virtual fresh water tank' },
        { type: 2, expected: 'Virtual waste water tank' },
        { type: 3, expected: 'Virtual live well tank' },
        { type: 4, expected: 'Virtual oil tank' },
        { type: 5, expected: 'Virtual black water (sewage) tank' },
        { type: 6, expected: 'Virtual gasoline tank' },
        { type: 7, expected: 'Virtual diesel tank' },
        { type: 8, expected: 'Virtual lpg tank' },
        { type: 9, expected: 'Virtual lng tank' },
        { type: 10, expected: 'Virtual hydraulic oil tank' },
        { type: 11, expected: 'Virtual raw water tank' }
      ]

      testCases.forEach(({ type, expected }) => {
        const config = { fluid_type: type }
        const iface = {}
        const ifaceDesc = { properties: { ...tankDevice.properties } }

        const result = tankDevice.configure(config, iface, ifaceDesc)
        expect(result).toBe(expected)
      })
    })

    test('should handle empty capacity configuration', () => {
      const config = { tank_capacity: '' }
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      tankDevice.configure(config, iface, ifaceDesc)

      expect(iface.Capacity).toBeUndefined()
    })

    test('should handle undefined capacity configuration', () => {
      const config = { tank_capacity: undefined }
      const iface = {}
      const ifaceDesc = { properties: { ...tankDevice.properties } }

      tankDevice.configure(config, iface, ifaceDesc)

      expect(iface.Capacity).toBeUndefined()
    })
  })
})
