const switchDevice = require('../src/nodes/victron-virtual/device-types/switch')

describe('Switch Device Configuration', () => {
  describe('Properties', () => {
    test('should have basic switch properties', () => {
      expect(switchDevice.properties).toBeDefined()
      expect(switchDevice.properties.Connected).toBeDefined()
      expect(switchDevice.properties.State).toBeDefined()
    })

    test('connected property should have correct configuration', () => {
      const connected = switchDevice.properties.Connected
      expect(connected.type).toBe('i')
      expect(connected.value).toBe(1)
      expect(connected.format(1)).toBe(1)
      expect(connected.format(null)).toBe('')
    })

    test('state property should have hex default value', () => {
      const state = switchDevice.properties.State
      expect(state.type).toBe('i')
      expect(state.value).toBe(0x100) // 256 in decimal
    })
  })

  describe('Device Configuration', () => {
    test('should configure single toggle switch by default', () => {
      const config = { switch_count: 1, switch_1_type: 1 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = switchDevice.configure(config, iface, ifaceDesc)

      // Check base properties for switch 1
      expect(iface['SwitchableOutput/output_1/State']).toBe(0)
      expect(iface['SwitchableOutput/output_1/Status']).toBe(0)
      expect(iface['SwitchableOutput/output_1/Name']).toBe('Switch 1')
      expect(iface['SwitchableOutput/output_1/Settings/Group']).toBe('')
      expect(iface['SwitchableOutput/output_1/Settings/CustomName']).toBe('')
      expect(iface['SwitchableOutput/output_1/Settings/Type']).toBe(1) // Toggle
      expect(iface['SwitchableOutput/output_1/Settings/ValidTypes']).toBe(0x7) // Allow all types

      // Should not have dimming property for toggle switch
      expect(iface['SwitchableOutput/output_1/Dimming']).toBeUndefined()

      expect(result).toBe('Virtual switch with 1 output')
    })

    test('should configure multiple switches', () => {
      const config = { 
        switch_count: 3,
        switch_1_type: 1, // Toggle
        switch_2_type: 0, // Momentary
        switch_3_type: 2  // Dimmable
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = switchDevice.configure(config, iface, ifaceDesc)

      // Check that all switches are created
      expect(iface['SwitchableOutput/output_1/Name']).toBe('Switch 1')
      expect(iface['SwitchableOutput/output_2/Name']).toBe('Switch 2')
      expect(iface['SwitchableOutput/output_3/Name']).toBe('Switch 3')

      // Check types are set correctly
      expect(iface['SwitchableOutput/output_1/Settings/Type']).toBe(1) // Toggle
      expect(iface['SwitchableOutput/output_2/Settings/Type']).toBe(0) // Momentary
      expect(iface['SwitchableOutput/output_3/Settings/Type']).toBe(2) // Dimmable

      // Only dimmable switch should have Dimming property
      expect(iface['SwitchableOutput/output_1/Dimming']).toBeUndefined()
      expect(iface['SwitchableOutput/output_2/Dimming']).toBeUndefined()
      expect(iface['SwitchableOutput/output_3/Dimming']).toBe(0)

      expect(result).toBe('Virtual switch with 3 outputs')
    })

    test('should create dimming property for dimmable switches', () => {
      const config = { switch_count: 1, switch_1_type: 2 } // Dimmable
      const iface = {}
      const ifaceDesc = { properties: {} }

      switchDevice.configure(config, iface, ifaceDesc)

      expect(iface['SwitchableOutput/output_1/Dimming']).toBe(0)
      
      // Check dimming property was added to ifaceDesc
      const dimmingProperty = ifaceDesc.properties['SwitchableOutput/output_1/Dimming']
      expect(dimmingProperty.type).toBe('d')
      expect(dimmingProperty.format(75.5)).toBe('75.5%')
      expect(dimmingProperty.format(null)).toBe('')
      expect(dimmingProperty.min).toBe(0)
      expect(dimmingProperty.max).toBe(100)
      expect(dimmingProperty.persist).toBe(true)
    })

    test('should handle maximum 4 switches', () => {
      const config = { 
        switch_count: 4,
        switch_1_type: 0,
        switch_2_type: 1,
        switch_3_type: 2,
        switch_4_type: 1
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = switchDevice.configure(config, iface, ifaceDesc)

      expect(iface['SwitchableOutput/output_4/Name']).toBe('Switch 4')
      expect(result).toBe('Virtual switch with 4 outputs')
    })

    test('should default to toggle type when switch type not specified', () => {
      const config = { switch_count: 2 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      switchDevice.configure(config, iface, ifaceDesc)

      expect(iface['SwitchableOutput/output_1/Settings/Type']).toBe(1) // Default to toggle
      expect(iface['SwitchableOutput/output_2/Settings/Type']).toBe(1) // Default to toggle
    })

    test('should validate switch type format functions', () => {
      const config = { switch_count: 1, switch_1_type: 0 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      switchDevice.configure(config, iface, ifaceDesc)

      // Test the format function for switch type
      const typeProperty = ifaceDesc.properties['SwitchableOutput/output_1/Settings/Type']
      expect(typeProperty.format(0)).toBe('Momentary')
      expect(typeProperty.format(1)).toBe('Toggle')
      expect(typeProperty.format(2)).toBe('Dimmable')
      expect(typeProperty.format(99)).toBe('unknown')
    })

    test('should validate state format functions', () => {
      const config = { switch_count: 1, switch_1_type: 1 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      switchDevice.configure(config, iface, ifaceDesc)

      // Test the format function for switch state
      const stateProperty = ifaceDesc.properties['SwitchableOutput/output_1/State']
      expect(stateProperty.format(0)).toBe('Off')
      expect(stateProperty.format(1)).toBe('On')
      expect(stateProperty.format(99)).toBe('unknown')
    })

    test('should set all base properties correctly', () => {
      const config = { switch_count: 1, switch_1_type: 1 }
      const iface = {}
      const ifaceDesc = { properties: {} }

      switchDevice.configure(config, iface, ifaceDesc)

      const expectedProperties = [
        'SwitchableOutput/output_1/State',
        'SwitchableOutput/output_1/Status', 
        'SwitchableOutput/output_1/Name',
        'SwitchableOutput/output_1/Settings/Group',
        'SwitchableOutput/output_1/Settings/CustomName',
        'SwitchableOutput/output_1/Settings/Type',
        'SwitchableOutput/output_1/Settings/ValidTypes'
      ]

      expectedProperties.forEach(prop => {
        expect(ifaceDesc.properties[prop]).toBeDefined()
        expect(iface[prop]).toBeDefined()
      })
    })
  })
})
