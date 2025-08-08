const gpsDevice = require('../src/nodes/victron-virtual/device-types/gps')

describe('GPS Device Configuration', () => {
  describe('Properties', () => {
    test('should have all required GPS properties', () => {
      expect(gpsDevice.properties).toBeDefined()
      expect(gpsDevice.properties.Altitude).toBeDefined()
      expect(gpsDevice.properties.Fix).toBeDefined()
      expect(gpsDevice.properties.NrOfSatellites).toBeDefined()
      expect(gpsDevice.properties['Position/Latitude']).toBeDefined()
      expect(gpsDevice.properties['Position/Longitude']).toBeDefined()
      expect(gpsDevice.properties.Speed).toBeDefined()
      expect(gpsDevice.properties.Course).toBeDefined()
      expect(gpsDevice.properties.Connected).toBeDefined()
    })

    test('altitude property should format correctly', () => {
      const altitude = gpsDevice.properties.Altitude
      expect(altitude.type).toBe('d')
      expect(altitude.format(123.5)).toBe('123.5m')
      expect(altitude.format(null)).toBe('')
    })

    test('fix property should be integer type', () => {
      const fix = gpsDevice.properties.Fix
      expect(fix.type).toBe('i')
    })

    test('number of satellites should be integer type', () => {
      const nrOfSatellites = gpsDevice.properties.NrOfSatellites
      expect(nrOfSatellites.type).toBe('i')
    })

    test('position latitude should format with precision', () => {
      const latitude = gpsDevice.properties['Position/Latitude']
      expect(latitude.type).toBe('d')
      expect(latitude.format(52.123456)).toBe('52.123456°')
      expect(latitude.format(null)).toBe('')
      expect(latitude.persist).toBe(300)
    })

    test('position longitude should format with precision', () => {
      const longitude = gpsDevice.properties['Position/Longitude']
      expect(longitude.type).toBe('d')
      expect(longitude.format(5.987654)).toBe('5.987654°')
      expect(longitude.format(null)).toBe('')
      expect(longitude.persist).toBe(300)
    })

    test('speed property should format correctly', () => {
      const speed = gpsDevice.properties.Speed
      expect(speed.type).toBe('d')
      expect(speed.format(15.5)).toBe('15.5m/s')
      expect(speed.format(null)).toBe('')
    })

    test('course property should format correctly', () => {
      const course = gpsDevice.properties.Course
      expect(course.type).toBe('d')
      expect(course.format(270.5)).toBe('270.5°')
      expect(course.format(null)).toBe('')
    })

    test('connected property should have default value', () => {
      const connected = gpsDevice.properties.Connected
      expect(connected.type).toBe('i')
      expect(connected.value).toBe(1)
      expect(connected.format(1)).toBe(1)
      expect(connected.format(null)).toBe('')
    })
  })

  describe('Device Configuration', () => {
    test('should configure GPS device without default values', () => {
      const config = { default_values: true }
      const iface = {}
      const ifaceDesc = { properties: gpsDevice.properties }

      const result = gpsDevice.configure(config, iface, ifaceDesc)

      // GPS devices should NOT set default position values to avoid putting device in ocean
      expect(iface['Position/Latitude']).toBeUndefined()
      expect(iface['Position/Longitude']).toBeUndefined()
      expect(iface.Altitude).toBeUndefined()
      expect(iface.Speed).toBeUndefined()
      expect(iface.Course).toBeUndefined()
      expect(iface.Fix).toBeUndefined()
      expect(iface.NrOfSatellites).toBeUndefined()
      
      expect(result).toBe('Virtual GPS')
    })

    test('should ignore default_values flag for GPS', () => {
      const config = { default_values: false }
      const iface = {}
      const ifaceDesc = { properties: gpsDevice.properties }

      const result = gpsDevice.configure(config, iface, ifaceDesc)

      expect(iface['Position/Latitude']).toBeUndefined()
      expect(iface['Position/Longitude']).toBeUndefined()
      expect(result).toBe('Virtual GPS')
    })

    test('should return consistent display text', () => {
      const configs = [
        { default_values: true },
        { default_values: false },
        {}
      ]

      configs.forEach(config => {
        const iface = {}
        const ifaceDesc = { properties: gpsDevice.properties }

        const result = gpsDevice.configure(config, iface, ifaceDesc)
        expect(result).toBe('Virtual GPS')
      })
    })
  })
})
