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
      expect(batteryProperties.Soc).toBeDefined()
      expect(batteryProperties.Soh).toBeDefined()
    })

    test('capacity property has correct format function and is NOT persistent', () => {
      const capacity = batteryProperties.Capacity
      expect(capacity.format).toBeDefined()
      expect(capacity.format(100)).toBe('100Ah')
      expect(capacity.format(null)).toBe('')
      expect(capacity.persist).toBeUndefined() // Should NOT be persistent
    })

    test('voltage property has correct format function', () => {
      const voltage = batteryProperties['Dc/0/Voltage']
      expect(voltage.format).toBeDefined()
      expect(voltage.format(12.34)).toBe('12.34V')
      expect(voltage.format(null)).toBe('')
    })

    test('SOC property has correct constraints and IS persistent', () => {
      const soc = batteryProperties.Soc
      expect(soc.min).toBe(0)
      expect(soc.max).toBe(100)
      expect(soc.persist).toBe(15) // Should be persistent with 15s throttle
      expect(soc.format(85.5)).toBe('86%')
    })
  })

  describe('Utils Functions', () => {
    test('createIfaceDesc creates proper interface description', () => {
      const ifaceDesc = createIfaceDesc('battery', batteryProperties)

      expect(ifaceDesc.Capacity).toBeDefined()
      expect(ifaceDesc['Dc/0/Current']).toBeDefined()
      expect(ifaceDesc.DeviceInstance).toBeDefined()
      expect(ifaceDesc.CustomName).toBeDefined()
      expect(ifaceDesc.Serial).toBeDefined()

      // Check that format functions are preserved
      expect(typeof ifaceDesc.Capacity.format).toBe('function')
      expect(ifaceDesc.Capacity.format(100)).toBe('100Ah')
    })

    test('createIface creates proper interface with default values', () => {
      const iface = createIface('battery', batteryProperties)

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
      const ifaceDesc = createIfaceDesc('unknown', null)
      expect(ifaceDesc).toEqual({})
    })

    test('createIface handles empty properties gracefully', () => {
      const iface = createIface('unknown', null)
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
      iface = createIface('battery', batteryProperties)
      ifaceDesc = { properties: createIfaceDesc('battery', batteryProperties) }
    })

    test('configures battery capacity when provided', () => {
      config.battery_capacity = '150'
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(150)
      expect(text).toBe('Virtual 150Ah battery')
    })

    test('handles non-numeric capacity gracefully', () => {
      config.battery_capacity = 'invalid'
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      // Should not set capacity when invalid
      expect(iface.Capacity).toBe(null) // Default from createIface
      expect(text).toContain('Virtual')
      expect(text).toContain('battery')
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
      expect(text).toBe('Virtual 100Ah battery')
      
      // Simulate redeployment with changed capacity (150Ah)
      config.battery_capacity = '150'
      text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(iface.Capacity).toBe(150)
      expect(text).toBe('Virtual 150Ah battery')
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
      expect(text).toBe('Virtual 200Ah battery')
    })

    test('handles missing capacity in display text', () => {
      // No capacity configured
      
      const text = configureBatteryDevice(config, iface, ifaceDesc)
      
      expect(text).toBe('Virtual  battery')
    })
  })
})