const { 
  deviceRegistry, 
  getDeviceConfig, 
  isDeviceSupported, 
  getSupportedDeviceTypes 
} = require('../src/nodes/victron-virtual/device-types')

describe('Device Registry', () => {
  describe('deviceRegistry', () => {
    test('contains battery and meteo devices', () => {
      expect(deviceRegistry).toBeDefined()
      expect(deviceRegistry.battery).toBeDefined()
      expect(deviceRegistry.meteo).toBeDefined()
    })

    test('battery device has required exports', () => {
      const battery = deviceRegistry.battery
      expect(battery.properties).toBeDefined()
      expect(battery.configure).toBeDefined()
      expect(typeof battery.configure).toBe('function')
    })

    test('meteo device has required exports', () => {
      const meteo = deviceRegistry.meteo
      expect(meteo.properties).toBeDefined()
      expect(meteo.configure).toBeDefined()
      expect(typeof meteo.configure).toBe('function')
    })
  })

  describe('getDeviceConfig', () => {
    test('returns battery device config', () => {
      const config = getDeviceConfig('battery')
      
      expect(config).toBeDefined()
      expect(config.properties).toBeDefined()
      expect(config.configure).toBeDefined()
      expect(config.properties.Capacity).toBeDefined()
    })

    test('returns meteo device config', () => {
      const config = getDeviceConfig('meteo')
      
      expect(config).toBeDefined()
      expect(config.properties).toBeDefined()
      expect(config.configure).toBeDefined()
      expect(config.properties.Irradiance).toBeDefined()
    })

    test('returns null for unsupported device', () => {
      const config = getDeviceConfig('unsupported-device')
      
      expect(config).toBe(null)
    })

    test('returns null for undefined device', () => {
      const config = getDeviceConfig()
      
      expect(config).toBe(null)
    })
  })

  describe('isDeviceSupported', () => {
    test('returns true for supported devices', () => {
      expect(isDeviceSupported('battery')).toBe(true)
      expect(isDeviceSupported('generator')).toBe(true)
      expect(isDeviceSupported('grid')).toBe(true)
      expect(isDeviceSupported('meteo')).toBe(true)
      expect(isDeviceSupported('tank')).toBe(true)
      expect(isDeviceSupported('temperature')).toBe(true)
    })

    test('returns false for unsupported devices', () => {
      expect(isDeviceSupported('evcs')).toBe(false)
      expect(isDeviceSupported('unknown')).toBe(false)
    })

    test('returns false for undefined device', () => {
      expect(isDeviceSupported()).toBe(false)
      expect(isDeviceSupported(null)).toBe(false)
    })
  })

  describe('getSupportedDeviceTypes', () => {
    test('returns array of supported device types', () => {
      const types = getSupportedDeviceTypes()
      
      expect(Array.isArray(types)).toBe(true)
      expect(types).toContain('battery')
      expect(types).toContain('meteo')
      expect(types.length).toBeGreaterThanOrEqual(2)
    })

    test('all returned types are actually supported', () => {
      const types = getSupportedDeviceTypes()
      
      types.forEach(type => {
        expect(isDeviceSupported(type)).toBe(true)
        expect(getDeviceConfig(type)).not.toBe(null)
      })
    })
  })

  describe('Integration with device modules', () => {
    test('battery device config works through registry', () => {
      const config = getDeviceConfig('battery')
      const { createIface } = require('../src/nodes/victron-virtual/utils')
      
      const nodeConfig = { device: 'battery', battery_capacity: '100' }
      const iface = createIface('battery', config.properties)
      const ifaceDesc = { properties: config.properties }
      
      const text = config.configure(nodeConfig, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(100)
      expect(text).toBe('Virtual 100.0Ah battery')
    })

    test('meteo device config works through registry', () => {
      const config = getDeviceConfig('meteo')
      const { createIface } = require('../src/nodes/victron-virtual/utils')
      
      const nodeConfig = { device: 'meteo', default_values: true }
      const iface = createIface('meteo', config.properties)
      const ifaceDesc = { properties: config.properties }
      
      const text = config.configure(nodeConfig, iface, ifaceDesc)
      
      expect(iface.Irradiance).toBe(0)
      expect(iface.WindSpeed).toBe(0)
      expect(text).toBe('Virtual meteo')
    })
  })
})
