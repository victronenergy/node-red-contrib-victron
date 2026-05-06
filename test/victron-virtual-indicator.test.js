/* eslint-env jest */

const { createIndicatorProperties, updateIndicatorStatus } = require('../src/services/virtual-indicator')

function makeIfaceAndDesc () {
  return {
    ifaceDesc: { properties: {} },
    iface: {}
  }
}

describe('createIndicatorProperties', () => {
  describe('common properties', () => {
    test('sets GenericInput/0/Value on ifaceDesc and iface', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({}, ifaceDesc, iface)
      expect(ifaceDesc.properties['GenericInput/0/Value']).toBeDefined()
      expect(iface['GenericInput/0/Value']).toBeDefined()
    })

    test('sets GenericInput/0/Status with default 0 (OK)', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({}, ifaceDesc, iface)
      expect(iface['GenericInput/0/Status']).toBe(0)
    })

    test('sets GenericInput/0/Name to the indicator type name', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 1 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Name']).toBe('Value')
    })

    test('sets Settings/CustomName from config', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ customname: 'My Indicator' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/CustomName']).toBe('My Indicator')
    })

    test('sets Settings/Group from config', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ group: 'Indicators' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Group']).toBe('Indicators')
    })

    test('sets Settings/ShowUIInput to 1 by default', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({}, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/ShowUIInput']).toBe(1)
    })

    test('sets Settings/Type from config', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 2 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Type']).toBe(2)
    })

    test('defaults Settings/Type to 1 (value without range) when not set', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({}, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Type']).toBe(1)
    })

    test('sets Settings/ValidTypes as bitmask for configured type', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 2 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/ValidTypes']).toBe(1 << 2)
    })
  })

  describe('unit', () => {
    test('sets Settings/Unit when provided', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ unit: 'kW' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Unit']).toBe('kW')
    })

    test('supports reserved unit keywords', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ unit: '/Temperature' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Unit']).toBe('/Temperature')
    })
  })

  describe('range (types 2 and 3)', () => {
    test('sets RangeMin and RangeMax when provided', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 2, range_min: -10, range_max: 100 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/RangeMin']).toBe(-10)
      expect(iface['GenericInput/0/Settings/RangeMax']).toBe(100)
    })

    test('does not set RangeMin/RangeMax for type 0 (discrete)', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 0 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/RangeMin']).toBeUndefined()
      expect(iface['GenericInput/0/Settings/RangeMax']).toBeUndefined()
    })
  })

  describe('labels (type 0 - discrete)', () => {
    test('sets Settings/Labels as string array for discrete type', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 0, labels: '/off,/on' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Labels']).toEqual(['/off', '/on'])
    })

    test('sets Settings/Labels type as "as"', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 0, labels: '/off,/on' }, ifaceDesc, iface)
      expect(ifaceDesc.properties['GenericInput/0/Settings/Labels'].type).toBe('as')
    })

    test('does not set Labels for non-discrete types', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 1, labels: '/off,/on' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Labels']).toBeUndefined()
    })
  })

  describe('decimals', () => {
    test('sets Settings/Decimals when provided', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ decimals: 2 }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/Decimals']).toBe(2)
    })
  })

  describe('primary label', () => {
    test('sets Settings/PrimaryLabel when provided', () => {
      const { ifaceDesc, iface } = makeIfaceAndDesc()
      createIndicatorProperties({ primary_label: 'Power' }, ifaceDesc, iface)
      expect(iface['GenericInput/0/Settings/PrimaryLabel']).toBe('Power')
    })
  })

  describe('Name property', () => {
    test('is marked readonly', () => {
      const { ifaceDesc } = makeIfaceAndDesc()
      createIndicatorProperties({}, ifaceDesc, {})
      expect(ifaceDesc.properties['GenericInput/0/Name'].readonly).toBe(true)
    })

    test('is set to the indicator type name', () => {
      const { iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 0 }, { properties: {} }, iface)
      expect(iface['GenericInput/0/Name']).toBe('Discrete')
    })

    test('defaults to Indicator for unknown type', () => {
      const { iface } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 99 }, { properties: {} }, iface)
      expect(iface['GenericInput/0/Name']).toBe('Indicator')
    })
  })

  describe('range Value min/max', () => {
    test('sets min and max on Value property for type 2 (value with range)', () => {
      const { ifaceDesc } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 2, range_min: -10, range_max: 50 }, ifaceDesc, {})
      const valueDesc = ifaceDesc.properties['GenericInput/0/Value']
      expect(valueDesc.min).toBe(-10)
      expect(valueDesc.max).toBe(50)
    })

    test('sets min and max on Value property for type 3 (temperature)', () => {
      const { ifaceDesc } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 3, range_min: -20, range_max: 60 }, ifaceDesc, {})
      const valueDesc = ifaceDesc.properties['GenericInput/0/Value']
      expect(valueDesc.min).toBe(-20)
      expect(valueDesc.max).toBe(60)
    })

    test('does not set min/max when range is not configured', () => {
      const { ifaceDesc } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 2 }, ifaceDesc, {})
      const valueDesc = ifaceDesc.properties['GenericInput/0/Value']
      expect(valueDesc.min).toBeUndefined()
      expect(valueDesc.max).toBeUndefined()
    })
  })

  describe('discrete Value min/max', () => {
    test('sets min=0 and max=labels.length-1 on Value property for discrete type', () => {
      const { ifaceDesc } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 0, labels: 'Off, On, Fault' }, ifaceDesc, {})
      const valueDesc = ifaceDesc.properties['GenericInput/0/Value']
      expect(valueDesc.min).toBe(0)
      expect(valueDesc.max).toBe(2)
    })

    test('does not set min/max on Value for non-discrete types', () => {
      const { ifaceDesc } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 1 }, ifaceDesc, {})
      const valueDesc = ifaceDesc.properties['GenericInput/0/Value']
      expect(valueDesc.min).toBeUndefined()
      expect(valueDesc.max).toBeUndefined()
    })

    test('does not set min/max when discrete type has no labels', () => {
      const { ifaceDesc } = makeIfaceAndDesc()
      createIndicatorProperties({ indicator_type: 0 }, ifaceDesc, {})
      const valueDesc = ifaceDesc.properties['GenericInput/0/Value']
      expect(valueDesc.min).toBeUndefined()
      expect(valueDesc.max).toBeUndefined()
    })
  })
})

describe('updateIndicatorStatus', () => {
  function makeNode (value, deviceInstance = 42) {
    return {
      iface: { DeviceInstance: deviceInstance, 'GenericInput/0/Value': value },
      status: jest.fn()
    }
  }

  test('shows value and label text for discrete indicator', () => {
    const node = makeNode(1)
    updateIndicatorStatus({ indicator_type: 0, labels: 'Off, On, Fault' }, node)
    expect(node.status).toHaveBeenCalledWith(expect.objectContaining({ text: '1: On (42)' }))
  })

  test('shows value and first label for value 0', () => {
    const node = makeNode(0)
    updateIndicatorStatus({ indicator_type: 0, labels: 'Off, On, Fault' }, node)
    expect(node.status).toHaveBeenCalledWith(expect.objectContaining({ text: '0: Off (42)' }))
  })

  test('falls back to numeric value when index has no matching label', () => {
    const node = makeNode(5)
    updateIndicatorStatus({ indicator_type: 0, labels: 'Off, On' }, node)
    expect(node.status).toHaveBeenCalledWith(expect.objectContaining({ text: '5: 5 (42)' }))
  })

  test('shows numeric value for non-discrete type', () => {
    const node = makeNode(42.5)
    updateIndicatorStatus({ indicator_type: 1, unit: 'W' }, node)
    expect(node.status).toHaveBeenCalledWith(expect.objectContaining({ text: '42.5W (42)' }))
  })

  test('shows no-value status when value is null', () => {
    const node = makeNode(null)
    updateIndicatorStatus({ indicator_type: 0, labels: 'Off, On' }, node)
    expect(node.status).toHaveBeenCalledWith(expect.objectContaining({ fill: 'grey' }))
  })
})
