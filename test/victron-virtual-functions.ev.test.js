// test/victron-virtual-functions.ev.test.js
/* eslint-env jest */
const { fetchEvChargers } = require('./fixtures/victron-virtual-functions.cjs')

describe('fetchEvChargers', () => {
  afterEach(() => {
    delete global.$
    delete global.fetch
  })

  function mockFetch (data) {
    global.$ = { getJSON: jest.fn().mockResolvedValue(data) }
    global.fetch = jest.fn()
  }

  test('returns chargers found in cache', async () => {
    mockFetch({
      'com.victronenergy.evcharger/40': {
        '/DeviceInstance': 40,
        '/CustomName': 'My EV Charger'
      }
    })
    const result = await fetchEvChargers()
    expect(result).toEqual([{ deviceInstance: 40, name: 'My EV Charger' }])
  })

  test('uses "EV Charger" as name when CustomName is absent', async () => {
    mockFetch({
      'com.victronenergy.evcharger/40': {
        '/DeviceInstance': 40
      }
    })
    const result = await fetchEvChargers()
    expect(result).toEqual([{ deviceInstance: 40, name: 'EV Charger' }])
  })

  test('falls back to device instance from service key when /DeviceInstance path is absent', async () => {
    mockFetch({
      'com.victronenergy.evcharger/40': { '/CustomName': 'EVC' }
    })
    const result = await fetchEvChargers()
    expect(result).toEqual([{ deviceInstance: 40, name: 'EVC' }])
  })

  test('ignores non-evcharger services', async () => {
    mockFetch({
      'com.victronenergy.battery/1': { '/DeviceInstance': 1 },
      'com.victronenergy.evcharger/40': { '/DeviceInstance': 40, '/CustomName': 'EVC' }
    })
    const result = await fetchEvChargers()
    expect(result).toHaveLength(1)
    expect(result[0].deviceInstance).toBe(40)
  })

  test('returns empty array when no evchargers in cache', async () => {
    mockFetch({ 'com.victronenergy.battery/1': { '/DeviceInstance': 1 } })
    const result = await fetchEvChargers()
    expect(result).toEqual([])
  })

  test('requests a relative cache path', async () => {
    mockFetch({})
    await fetchEvChargers()
    expect(global.$.getJSON).toHaveBeenCalledWith('victron/cache')
  })

  // fetch() would skip the admin auth token that Node-RED adds to jQuery requests
  test('does not use fetch', async () => {
    mockFetch({})
    await fetchEvChargers()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('EV brand dropdown', () => {
  const { EV_BRANDS, evBrandToSelection, evBrandFromSelection, EV_BRAND_OTHER } = require('./fixtures/victron-virtual-functions.cjs')

  describe('EV_BRANDS', () => {
    test('has unique values that do not clash with the dropdown sentinels', () => {
      const values = EV_BRANDS.map(b => b.value)
      expect(new Set(values).size).toBe(values.length)
      expect(values).not.toContain('')
      expect(values).not.toContain(EV_BRAND_OTHER)
    })
  })

  describe('evBrandToSelection', () => {
    test('selects a known brand without custom text', () => {
      expect(evBrandToSelection('tesla')).toEqual({ select: 'tesla', custom: '' })
    })

    test.each([
      ['undefined (legacy node)', undefined],
      ['null', null],
      ['empty', ''],
      ['whitespace only', '  ']
    ])('selects the placeholder when the stored brand is %s', (_desc, brand) => {
      expect(evBrandToSelection(brand)).toEqual({ select: '', custom: '' })
    })

    test('shows a stored "unknown" as typed custom text', () => {
      expect(evBrandToSelection('unknown')).toEqual({ select: EV_BRAND_OTHER, custom: 'unknown' })
    })

    test('selects Other and keeps a custom brand as typed', () => {
      expect(evBrandToSelection('Lynk & Co')).toEqual({ select: EV_BRAND_OTHER, custom: 'Lynk & Co' })
    })

    test('treats a differently cased known brand as custom text', () => {
      expect(evBrandToSelection('Tesla')).toEqual({ select: EV_BRAND_OTHER, custom: 'Tesla' })
    })
  })

  describe('evBrandFromSelection', () => {
    test('returns the selected known brand and ignores leftover custom text', () => {
      expect(evBrandFromSelection('kia', 'Lynk & Co')).toBe('kia')
    })

    test('returns the trimmed custom text when Other is selected', () => {
      expect(evBrandFromSelection(EV_BRAND_OTHER, '  Lynk & Co ')).toBe('Lynk & Co')
    })

    test('returns empty when the placeholder is selected', () => {
      expect(evBrandFromSelection('', 'Lynk & Co')).toBe('')
    })

    test('returns empty when Other is selected without custom text', () => {
      expect(evBrandFromSelection(EV_BRAND_OTHER, '   ')).toBe('')
    })

    test('round-trips a custom brand', () => {
      const { select, custom } = evBrandToSelection('Lynk & Co')
      expect(evBrandFromSelection(select, custom)).toBe('Lynk & Co')
    })
  })
})
