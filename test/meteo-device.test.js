const { createIfaceDesc, createIface } = require('../src/nodes/victron-virtual/utils')

describe('Meteo Device Configuration', () => {
  // Expected meteo properties based on the original code
  const expectedMeteoProperties = {
    CellTemperature: { type: 'd', format: expect.any(Function), persist: 300 },
    ExternalTemperature: { type: 'd', format: expect.any(Function), persist: 300 },
    Irradiance: { type: 'd', format: expect.any(Function), persist: 300 },
    WindSpeed: { type: 'd', format: expect.any(Function), persist: 300 },
    WindDirection: { type: 'i', persist: 300 }
  }

  describe('Properties', () => {
    test('should have all required meteo properties', () => {
      // This test will pass once you create the meteo device file
      const meteoDevice = require('../src/nodes/victron-virtual/device-types/meteo')
      
      expect(meteoDevice.properties).toBeDefined()
      expect(meteoDevice.properties.Irradiance).toBeDefined()
      expect(meteoDevice.properties.WindSpeed).toBeDefined()
      expect(meteoDevice.properties.CellTemperature).toBeDefined()
      expect(meteoDevice.properties.ExternalTemperature).toBeDefined()
      expect(meteoDevice.properties.WindDirection).toBeDefined()
    })

    test('irradiance property should have correct format function', () => {
      const meteoDevice = require('../src/nodes/victron-virtual/device-types/meteo')
      
      const irradiance = meteoDevice.properties.Irradiance
      expect(irradiance.format).toBeDefined()
      expect(irradiance.format(850.5)).toBe('850.5W/m2')
      expect(irradiance.format(null)).toBe('')
      expect(irradiance.persist).toBe(300) // Should be persistent with 5 min throttle
    })

    test('wind speed property should have correct format function', () => {
      const meteoDevice = require('../src/nodes/victron-virtual/device-types/meteo')
      
      const windSpeed = meteoDevice.properties.WindSpeed
      expect(windSpeed.format).toBeDefined()
      expect(windSpeed.format(12.3)).toBe('12.3m/s')
      expect(windSpeed.format(null)).toBe('')
      expect(windSpeed.persist).toBe(300)
    })

    test('temperature properties should have correct format', () => {
      const meteoDevice = require('../src/nodes/victron-virtual/device-types/meteo')
      
      const cellTemp = meteoDevice.properties.CellTemperature
      expect(cellTemp.format(25.7)).toBe('25.7C')
      expect(cellTemp.persist).toBe(300)

      const extTemp = meteoDevice.properties.ExternalTemperature
      expect(extTemp.format(-5.2)).toBe('-5.2C')
      expect(extTemp.persist).toBe(300)
    })

    test('wind direction should be integer type', () => {
      const meteoDevice = require('../src/nodes/victron-virtual/device-types/meteo')
      
      const windDirection = meteoDevice.properties.WindDirection
      expect(windDirection.type).toBe('i')
      expect(windDirection.persist).toBe(300)
    })
  })

  describe('Utils Functions', () => {
    test('createIfaceDesc creates proper interface description for meteo', () => {
      const meteoDevice = require('../src/nodes/victron-virtual/device-types/meteo')
      
      const ifaceDesc = createIfaceDesc(meteoDevice.properties)

      expect(ifaceDesc.Irradiance).toBeDefined()
      expect(ifaceDesc.WindSpeed).toBeDefined()
      expect(ifaceDesc.CellTemperature).toBeDefined()
      expect(ifaceDesc.DeviceInstance).toBeDefined()
      expect(ifaceDesc.CustomName).toBeDefined()
      expect(ifaceDesc.Serial).toBeDefined()

      // Check that format functions are preserved
      expect(typeof ifaceDesc.Irradiance.format).toBe('function')
      expect(ifaceDesc.Irradiance.format(1000)).toBe('1000.0W/m2')
    })

    test('createIface creates proper interface with default values for meteo', () => {
      const meteoDevice = require('../src/nodes/victron-virtual/device-types/meteo')
      
      const iface = createIface(meteoDevice.properties)

      expect(iface.emit).toBeDefined()
      expect(typeof iface.emit).toBe('function')

      // All meteo properties should default to null (no predefined values)
      expect(iface.Irradiance).toBe(null)
      expect(iface.WindSpeed).toBe(null)
      expect(iface.CellTemperature).toBe(null)
      expect(iface.ExternalTemperature).toBe(null)
      expect(iface.WindDirection).toBe(null)
    })
  })

  describe('Meteo Configuration', () => {
    let config, iface, ifaceDesc, meteoDevice

    beforeEach(() => {
      config = {
        device: 'meteo'
      }
      
      meteoDevice = require('../src/nodes/victron-virtual/device-types/meteo')
      iface = createIface(meteoDevice.properties)
      ifaceDesc = { properties: createIfaceDesc(meteoDevice.properties) }
    })

    test('configures meteo device with basic setup', () => {
      const text = meteoDevice.configure(config, iface, ifaceDesc)
      
      expect(text).toBe('Virtual meteo')
    })

    test('sets default values when requested', () => {
      config.default_values = true
      
      meteoDevice.configure(config, iface, ifaceDesc)
      
      // Based on original code, only Irradiance and WindSpeed get default values
      expect(iface.Irradiance).toBe(0)
      expect(iface.WindSpeed).toBe(0)
      
      // Other values should remain null
      expect(iface.CellTemperature).toBe(null)
      expect(iface.ExternalTemperature).toBe(null)
      expect(iface.WindDirection).toBe(null)
    })

    test('handles no default values', () => {
      config.default_values = false
      
      meteoDevice.configure(config, iface, ifaceDesc)
      
      // All values should remain null when no defaults requested
      expect(iface.Irradiance).toBe(null)
      expect(iface.WindSpeed).toBe(null)
      expect(iface.CellTemperature).toBe(null)
      expect(iface.ExternalTemperature).toBe(null)
      expect(iface.WindDirection).toBe(null)
    })

    test('returns appropriate display text', () => {
      const text = meteoDevice.configure(config, iface, ifaceDesc)
      
      expect(text).toBe('Virtual meteo')
    })

    test('all properties are persistent with 5-minute throttle', () => {
      // All meteo properties should persist with 300 second (5 min) throttle
      Object.values(meteoDevice.properties).forEach(property => {
        expect(property.persist).toBe(300)
      })
    })

    test('handles configuration without any specific options', () => {
      // Meteo device has no specific configuration options
      const text = meteoDevice.configure(config, iface, ifaceDesc)
      
      expect(text).toContain('Virtual')
      expect(text).toContain('meteo')
      expect(() => meteoDevice.configure(config, iface, ifaceDesc)).not.toThrow()
    })
  })
})
