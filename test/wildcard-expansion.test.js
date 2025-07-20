const { expandWildcardPaths } = require('../src/services/utils')

describe('Wildcard Path Expansion', () => {
  test('expands {type} wildcards for switch paths', () => {
    const pathObj = {
      path: '/SwitchableOutput/{type}/State',
      name: '{type} state',
      type: 'enum',
      enum: { '0': 'Off', '1': 'On' }
    }

    const cachedPaths = {
      '/SwitchableOutput/output_1/State': 0,
      '/SwitchableOutput/0/State': 1,
      '/SomeOtherPath': 'value'
    }

    const result = expandWildcardPaths(pathObj, cachedPaths, 'switch')

    expect(result).toHaveLength(2)
    expect(result[0].path).toBe('/SwitchableOutput/output_1/State')
    expect(result[0].name).toBe('Output 1 state')
    expect(result[1].path).toBe('/SwitchableOutput/0/State')
    expect(result[1].name).toBe('0 state')
  })

  test('uses custom names for switches when available', () => {
    const pathObj = {
      path: '/SwitchableOutput/{type}/State',
      name: '{type} state',
      type: 'enum',
      enum: { '0': 'Off', '1': 'On' }
    }

    const cachedPaths = {
      '/SwitchableOutput/output_1/State': 0,
      '/SwitchableOutput/output_1/Settings/CustomName': 'Kitchen Lights',
      '/SwitchableOutput/output_2/State': 1,
      '/SwitchableOutput/output_2/Name': 'Living Room Fan',
      '/SwitchableOutput/output_3/State': 0
      // output_3 has no custom name
    }

    const result = expandWildcardPaths(pathObj, cachedPaths, 'switch')

    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('Kitchen Lights state')
    expect(result[1].name).toBe('Living Room Fan state') 
    expect(result[2].name).toBe('Output 3 state') // fallback
  })

  test('returns original path when no wildcards', () => {
    const pathObj = {
      path: '/DeviceInstance',
      name: 'Device instance'
    }

    const cachedPaths = {
      '/DeviceInstance': 0
    }

    const result = expandWildcardPaths(pathObj, cachedPaths, 'switch')

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(pathObj)
  })

  test('returns empty array when wildcard path not found', () => {
    const pathObj = {
      path: '/Missing/{type}/Path',
      name: '{type} missing'
    }

    const cachedPaths = {
      '/DeviceInstance': 0
    }

    const result = expandWildcardPaths(pathObj, cachedPaths, 'switch')

    expect(result).toHaveLength(0)
  })
})
