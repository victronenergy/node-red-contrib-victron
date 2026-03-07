/* eslint-env jest */

const { createSensorProperties } = require('../src/services/virtual-sensor')

function makeIfaceAndDesc () {
  return {
    ifaceDesc: { properties: {} },
    iface: {}
  }
}

describe('createSensorProperties', () => {
  describe('common properties', () => {
    test('sets GenericInput/0/Value on ifaceDesc and iface', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({}, ifaceDesc, iface)
      expect(ifaceDesc.properties['GenericInput/0/Value']).toBeDefined()
      expect(iface['GenericInput/0/Value']).toBeDefined()
    })

    test('sets GenericInput/0/Status with default 0 (OK)', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({}, ifaceDesc, iface)
      expect(iface['GenericInput/0/Status']).toBe(0)
    })

    test('sets GenericInput/0/Name from config', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ customname: 'My Sensor' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Name']).toBe('My Sensor')
    })

    test('sets Settings/CustomName from config', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ customname: 'My Sensor' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/CustomName']).toBe('My Sensor')
    })

    test('sets Settings/Group from config', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ group: 'Sensors' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Group']).toBe('Sensors')
    })

    test('sets Settings/ShowUIInput to 6 by default', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({}, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/ShowUIInput']).toBe(6)
    })

    test('sets Settings/Type from config', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ sensor_type: 2 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Type']).toBe(2)
    })

    test('defaults Settings/Type to 1 (value without range) when not set', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({}, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Type']).toBe(1)
    })

    test('sets Settings/ValidTypes as bitmask for configured type', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ sensor_type: 2 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/ValidTypes']).toBe(1 << 2)
    })
  })

  describe('unit', () => {
    test('sets Settings/Unit when provided', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ unit: 'kW' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Unit']).toBe('kW')
    })

    test('supports reserved unit keywords', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ unit: '/Temperature' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Unit']).toBe('/Temperature')
    })
  })

  describe('range (types 2 and 3)', () => {
    test('sets RangeMin and RangeMax when provided', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ sensor_type: 2, range_min: -10, range_max: 100 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/RangeMin']).toBe(-10)
      expect(iface['GenericInput/0/Settings/RangeMax']).toBe(100)
    })

    test('does not set RangeMin/RangeMax for type 0 (discrete)', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ sensor_type: 0 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/RangeMin']).toBeUndefined()
      expect(iface['GenericInput/0/Settings/RangeMax']).toBeUndefined()
    })
  })

  describe('labels (type 0 - discrete)', () => {
    test('sets Settings/Labels as string array for discrete type', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ sensor_type: 0, labels: '/off,/on' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Labels']).toEqual(['/off', '/on'])
    })

    test('sets Settings/Labels type as "as"', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ sensor_type: 0, labels: '/off,/on' }, ifaceDesc, iface)
      expect(ifaceDesc.properties['GenericInput/0/Settings/Labels'].type).toBe('as')
    })

    test('does not set Labels for non-discrete types', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ sensor_type: 1, labels: '/off,/on' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Labels']).toBeUndefined()
    })
  })

  describe('decimals', () => {
    test('sets Settings/Decimals when provided', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ decimals: 2 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Decimals']).toBe(2)
    })
  })

  describe('primary label', () => {
    test('sets Settings/PrimaryLabel when provided', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createSensorProperties({ primary_label: 'Power' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/PrimaryLabel']).toBe('Power')
    })
  })
})
