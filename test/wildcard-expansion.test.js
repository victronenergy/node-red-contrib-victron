const { expandWildcardPaths } = require('../src/services/utils')

describe('Wildcard Path Expansion', () => {
  test('expands {type} wildcards for switch paths', () => {
    const pathObj = {
      path: '/SwitchableOutput/{type}/State',
      name: '{type} state',
      type: 'enum',
      enum: { 0: 'Off', 1: 'On' }
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
      enum: { 0: 'Off', 1: 'On' }
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

  test('uses generic input names for {input} wildcards on switches', () => {
    const pathObj = {
      path: '/GenericInput/{input}/Value',
      name: '{input} value',
      type: 'integer'
    }

    const cachedPaths = {
      '/GenericInput/01/Value': 0,
      '/GenericInput/01/Name': 'input 01',
      '/GenericInput/01/Settings/CustomName': '',
      '/GenericInput/02/Value': 1,
      '/GenericInput/02/Name': 'input 02',
      '/GenericInput/02/Settings/CustomName': 'Galley button',
      '/GenericInput/03/Value': 0,
      // a switchable output with the same id must not be used for the input name
      '/SwitchableOutput/03/Name': 'output 03'
    }

    const result = expandWildcardPaths(pathObj, cachedPaths, 'switch')

    expect(result.map(r => r.name)).toEqual(['input 01 value', 'Galley button value', '03 value'])
  })

  test('keeps using switchable output names for {type} wildcards', () => {
    const pathObj = {
      path: '/SwitchableOutput/{type}/Status',
      name: '{type} status',
      type: 'enum'
    }

    const cachedPaths = {
      '/SwitchableOutput/10/Status': 9,
      '/SwitchableOutput/10/Name': 'output 10',
      '/GenericInput/10/Name': 'input 10'
    }

    const result = expandWildcardPaths(pathObj, cachedPaths, 'switch')

    expect(result.map(r => r.name)).toEqual(['output 10 status'])
  })
})
