// test/victron-virtual-functions.ev.test.js
/* eslint-env jest */
const { fetchEvChargers } = require('./fixtures/victron-virtual-functions.cjs')

describe('fetchEvChargers', () => {
  afterEach(() => {
    global.fetch = undefined
  })

  function mockFetch (data) {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(data)
    })
  }

  test('returns chargers found in cache', async () => {
    mockFetch({
      'com.victronenergy.evcharger/40': {
        '/DeviceInstance': 40,
        '/CustomName': 'My EV Charger'
      }
    })
    const result = await fetchEvChargers('')
    expect(result).toEqual([{ deviceInstance: 40, name: 'My EV Charger' }])
  })

  test('uses "EV Charger" as name when CustomName is absent', async () => {
    mockFetch({
      'com.victronenergy.evcharger/40': {
        '/DeviceInstance': 40
      }
    })
    const result = await fetchEvChargers('')
    expect(result).toEqual([{ deviceInstance: 40, name: 'EV Charger' }])
  })

  test('falls back to device instance from service key when /DeviceInstance path is absent', async () => {
    mockFetch({
      'com.victronenergy.evcharger/40': { '/CustomName': 'EVC' }
    })
    const result = await fetchEvChargers('')
    expect(result).toEqual([{ deviceInstance: 40, name: 'EVC' }])
  })

  test('ignores non-evcharger services', async () => {
    mockFetch({
      'com.victronenergy.battery/1': { '/DeviceInstance': 1 },
      'com.victronenergy.evcharger/40': { '/DeviceInstance': 40, '/CustomName': 'EVC' }
    })
    const result = await fetchEvChargers('')
    expect(result).toHaveLength(1)
    expect(result[0].deviceInstance).toBe(40)
  })

  test('returns empty array when no evchargers in cache', async () => {
    mockFetch({ 'com.victronenergy.battery/1': { '/DeviceInstance': 1 } })
    const result = await fetchEvChargers('')
    expect(result).toEqual([])
  })

  test('prefixes baseUrl to the cache request', async () => {
    mockFetch({})
    await fetchEvChargers('/node-red')
    expect(global.fetch).toHaveBeenCalledWith('/node-red/victron/cache')
  })
})
