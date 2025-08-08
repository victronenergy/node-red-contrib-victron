const motordriveDevice = require('../src/nodes/victron-virtual/device-types/motordrive')

describe('Motordrive Device Configuration', () => {
  describe('Properties', () => {
    test('should have core DC properties', () => {
      const props = motordriveDevice.properties
      
      expect(props['Dc/0/Current']).toBeDefined()
      expect(props['Dc/0/Power']).toBeDefined()
      expect(props['Dc/0/Voltage']).toBeDefined()
      expect(props.Connected).toBeDefined()
    })

    test('should have temperature monitoring properties', () => {
      const props = motordriveDevice.properties
      
      expect(props['Motor/Temperature']).toBeDefined()
      expect(props['Controller/Temperature']).toBeDefined()
      expect(props['Coolant/Temperature']).toBeDefined()
    })

    test('should have motor monitoring properties', () => {
      const props = motordriveDevice.properties
      
      expect(props['Motor/RPM']).toBeDefined()
      expect(props['Motor/Direction']).toBeDefined()
    })

    test('motor direction should have correct enum values', () => {
      const direction = motordriveDevice.properties['Motor/Direction']
      
      expect(direction.format(0)).toBe('Neutral')
      expect(direction.format(1)).toBe('Reverse')
      expect(direction.format(2)).toBe('Forward')
      expect(direction.format(99)).toBe('unknown')
      expect(direction.value).toBe(0)
      expect(direction.persist).toBe(true)
    })

    test('current property should format correctly', () => {
      const current = motordriveDevice.properties['Dc/0/Current']
      
      expect(current.format(15.25)).toBe('15.25A')
      expect(current.format(-5.5)).toBe('-5.50A')
      expect(current.format(null)).toBe('')
    })

    test('RPM should format as integer', () => {
      const rpm = motordriveDevice.properties['Motor/RPM']
      
      expect(rpm.format(1500.7)).toBe('1501RPM')
      expect(rpm.format(0)).toBe('0RPM')
      expect(rpm.format(null)).toBe('')
    })
  })

  describe('Configuration Function', () => {
    test('configures minimal motor drive', () => {
      const config = {
        include_motor_temp: false,
        include_controller_temp: false,
        include_coolant_temp: false,
        include_motor_rpm: false,
        include_motor_direction: false
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = motordriveDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual motor drive')
    })

    test('configures motor drive with RPM only', () => {
      const config = {
        include_motor_temp: false,
        include_controller_temp: false,
        include_coolant_temp: false,
        include_motor_rpm: true,
        include_motor_direction: false
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = motordriveDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual motor drive with RPM')
    })

    test('configures motor drive with direction only', () => {
      const config = {
        include_motor_temp: false,
        include_controller_temp: false,
        include_coolant_temp: false,
        include_motor_rpm: false,
        include_motor_direction: true
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = motordriveDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual motor drive with direction')
    })

    test('configures motor drive with RPM and direction', () => {
      const config = {
        include_motor_temp: false,
        include_controller_temp: false,
        include_coolant_temp: false,
        include_motor_rpm: true,
        include_motor_direction: true
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      const result = motordriveDevice.configure(config, iface, ifaceDesc)

      expect(result).toBe('Virtual motor drive with RPM and direction')
    })

    test('sets default values when enabled', () => {
      const config = {
        default_values: true,
        include_motor_temp: true,
        include_controller_temp: true,
        include_coolant_temp: true,
        include_motor_rpm: true,
        include_motor_direction: true
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      motordriveDevice.configure(config, iface, ifaceDesc)

      expect(iface['Dc/0/Current']).toBe(0)
      expect(iface['Dc/0/Voltage']).toBe(48)
      expect(iface['Dc/0/Power']).toBe(0)
      expect(iface['Motor/Temperature']).toBe(30)
      expect(iface['Controller/Temperature']).toBe(35)
      expect(iface['Coolant/Temperature']).toBe(40)
      expect(iface['Motor/RPM']).toBe(0)
      expect(iface['Motor/Direction']).toBe(0)
    })

    test('removes optional properties when disabled', () => {
      const config = {
        include_motor_temp: false,
        include_controller_temp: false,
        include_coolant_temp: false,
        include_motor_rpm: false,
        include_motor_direction: false
      }
      const iface = {
        'Motor/Temperature': 25,
        'Controller/Temperature': 30,
        'Coolant/Temperature': 35,
        'Motor/RPM': 1000,
        'Motor/Direction': 1
      }
      const ifaceDesc = {
        properties: {
          'Motor/Temperature': {},
          'Controller/Temperature': {},
          'Coolant/Temperature': {},
          'Motor/RPM': {},
          'Motor/Direction': {}
        }
      }

      motordriveDevice.configure(config, iface, ifaceDesc)

      expect(iface['Motor/Temperature']).toBeUndefined()
      expect(iface['Controller/Temperature']).toBeUndefined()
      expect(iface['Coolant/Temperature']).toBeUndefined()
      expect(iface['Motor/RPM']).toBeUndefined()
      expect(iface['Motor/Direction']).toBeUndefined()
      expect(ifaceDesc.properties['Motor/Temperature']).toBeUndefined()
      expect(ifaceDesc.properties['Controller/Temperature']).toBeUndefined()
    })

    test('only sets temperature defaults when enabled', () => {
      const config = {
        default_values: true,
        include_motor_temp: true,
        include_controller_temp: false,
        include_coolant_temp: true,
        include_motor_rpm: false,
        include_motor_direction: false
      }
      const iface = {}
      const ifaceDesc = { properties: {} }

      motordriveDevice.configure(config, iface, ifaceDesc)

      expect(iface['Motor/Temperature']).toBe(30)
      expect(iface['Controller/Temperature']).toBeUndefined()
      expect(iface['Coolant/Temperature']).toBe(40)
      expect(iface['Motor/RPM']).toBeUndefined()
      expect(iface['Motor/Direction']).toBeUndefined()
    })
  })
})
