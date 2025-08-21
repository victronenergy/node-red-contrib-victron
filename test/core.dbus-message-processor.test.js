const {
  parseItemsChangedEntry,
  processItemsChanged
} = require('../src/services/core/dbus-message-processor')

describe('dbus message processing - issue #267 fix', () => {
  const entryWithBothFields = [
    "/Ac/L1/Power",
    [
      [
        "Text",
        [
          [{ "type": "s", "child": [] }],
          ["1332W"]
        ]
      ],
      [
        "Value", 
        [
          [{ "type": "d", "child": [] }],
          [1331.7]
        ]
      ]
    ]
  ]
  
  const entryWithValueOnly = [
    "/Ac/Frequency",
    [
      [
        "Value",
        [
          [{ "type": "d", "child": [] }],
          [49.971000000000004]
        ]
      ]
    ]
  ]

  test('parses entry with both Value and Text', () => {
    const result = parseItemsChangedEntry(entryWithBothFields)
    
    expect(result.path).toBe('/Ac/L1/Power')
    expect(result.value).toBe(1331.7)
    expect(result.text).toBe('1332W')
    expect(result.changed).toBe(true)
  })

  test('parses entry with Value only (the fix for issue #267)', () => {
    const result = parseItemsChangedEntry(entryWithValueOnly)
    
    expect(result.path).toBe('/Ac/Frequency')
    expect(result.value).toBe(49.971000000000004)
    expect(result.text).toBeUndefined()
    expect(result.changed).toBe(true)
  })

  test('processes complete message with mixed entry types', () => {
    const msg = {
      sender: 'com.victronenergy.vebus.ttyUSB0',
      body: [[entryWithBothFields, entryWithValueOnly]]
    }
    
    const services = {
      'com.victronenergy.vebus.ttyUSB0': {
        name: 'com.victronenergy.vebus.ttyUSB0',
        deviceInstance: 0
      }
    }
    
    const mockSearchFn = jest.fn()
    const result = processItemsChanged(msg, services, mockSearchFn)
    
    expect(result).toHaveLength(2)
    expect(result[0].path).toBe('/Ac/L1/Power')
    expect(result[0].text).toBe('1332W')
    expect(result[1].path).toBe('/Ac/Frequency')
    expect(result[1].text).toBeUndefined()
  })

  test('filters out entries with null values', () => {
    const entryWithNullValue = ["/Test", [["Value", [[], [null]]]]]
    const result = parseItemsChangedEntry(entryWithNullValue)
    
    expect(result.value).toBe(null)
    
    // This should be filtered out in processItemsChanged
    const msg = { sender: 'test', body: [[entryWithNullValue]] }
    const services = { test: { name: 'test', deviceInstance: 0 } }
    const messages = processItemsChanged(msg, services, jest.fn())
    
    expect(messages).toHaveLength(0)
  })
})
