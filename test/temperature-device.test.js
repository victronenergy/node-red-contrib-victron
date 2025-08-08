const temperatureDevice = require('../src/nodes/victron-virtual/device-types/temperature')

describe('Temperature Device Configuration', () => {
  describe('Properties', () => {
    test('should have all required temperature properties', () => {
      expect(temperatureDevice.properties).toBeDefined()
      expect(temperatureDevice.properties.Temperature).toBeDefined()
      expect(temperatureDevice.properties.TemperatureType).toBeDefined()
      expect(temperatureDevice.properties.Pressure).toBeDefined()
      expect(temperatureDevice.properties.Humidity).toBeDefined()
      expect(temperatureDevice.properties.BatteryVoltage).toBeDefined()
      expect(temperatureDevice.properties.Status).toBeDefined()
    })

    test('temperature property should have correct format and persistence', () => {
      const temp = temperatureDevice.properties.Temperature
      expect(temp.type).toBe('d')
      expect(temp.format(25.6)).toBe('25.6C')
      expect(temp.format(null)).toBe('')
      expect(temp.persist).toBe(60)
    })

    test('temperature type should have correct enum formatting', () => {
      const tempType = temperatureDevice.properties.TemperatureType
      expect(tempType.type).toBe('i')
      expect(tempType.value).toBe(2) // Default to Generic
      expect(tempType.min).toBe(0)
      expect(tempType.max).toBe(2)
      expect(tempType.format(0)).toBe('Battery')
      expect(tempType.format(1)).toBe('Fridge')
      expect(tempType.format(2)).toBe('Generic')
      expect(tempType.format(3)).toBe('Room')
      expect(tempType.format(4)).toBe('Outdoor')
      expect(tempType.format(5)).toBe('WaterHeater')
      expect(tempType.format(6)).toBe('Freezer')
      expect(tempType.format(99)).toBe('unknown')
    })

    test('pressure property should format correctly', () => {
      const pressure = temperatureDevice.properties.Pressure
      expect(pressure.type).toBe('d')
      expect(pressure.format(1013.25)).toBe('1013hPa')
      expect(pressure.format(null)).toBe('')
      expect(pressure.persist).toBe(60)
    })

    test('humidity property should format correctly', () => {
      const humidity = temperatureDevice.properties.Humidity
      expect(humidity.type).toBe('d')
      expect(humidity.format(65.5)).toBe('65.5%')
      expect(humidity.format(null)).toBe('')
      expect(humidity.persist).toBe(60)
    })

    test('battery voltage should have default value and correct formatting', () => {
      const batteryVoltage = temperatureDevice.properties.BatteryVoltage
      expect(batteryVoltage.type).toBe('d')
      expect(batteryVoltage.value).toBe(3.3)
      expect(batteryVoltage.format(3.25)).toBe('3.25V')
      expect(batteryVoltage.format(null)).toBe('')
    })
  })

  describe('Device Configuration', () => {
    test('should configure temperature device with default values', () => {
      const config = { default_values: true }
      const iface = { TemperatureType: 2 } // Set type explicitly like original code
      const ifaceDesc = { properties: temperatureDevice.properties }

      const result = temperatureDevice.configure(config, iface, ifaceDesc)

      expect(iface.Temperature).toBe(25)
      expect(iface.Humidity).toBe(50)
      expect(iface.Pressure).toBe(1013)
      expect(iface.BatteryVoltage).toBe(3.3)
      expect(result).toBe('Virtual generic temperature sensor')
    })

    test('should not set default values when disabled', () => {
      const config = { default_values: false }
      const iface = { TemperatureType: 2 }
      const ifaceDesc = { properties: temperatureDevice.properties }

      const result = temperatureDevice.configure(config, iface, ifaceDesc)

      expect(iface.Temperature).toBeUndefined()
      expect(iface.Humidity).toBeUndefined()
      expect(iface.Pressure).toBeUndefined()
      expect(result).toBe('Virtual generic temperature sensor')
    })

    test('should handle different temperature types for display text', () => {
      const testCases = [
        { type: 0, expected: 'Virtual battery temperature sensor' },
        { type: 1, expected: 'Virtual fridge temperature sensor' },
        { type: 2, expected: 'Virtual generic temperature sensor' },
        { type: 3, expected: 'Virtual room temperature sensor' },
        { type: 4, expected: 'Virtual outdoor temperature sensor' },
        { type: 5, expected: 'Virtual waterheater temperature sensor' },
        { type: 6, expected: 'Virtual freezer temperature sensor' }
      ]

      testCases.forEach(({ type, expected }) => {
        const config = { temperature_type: type }
        const iface = {  }
        const ifaceDesc = { properties: temperatureDevice.properties }

        const result = temperatureDevice.configure(config, iface, ifaceDesc)
        expect(result).toBe(expected)
      })
    })
  })
})