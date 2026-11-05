/* eslint-env jest */
const { addVictronInterfaces } = require('dbus-victron-virtual')
const evcs = require('../src/nodes/victron-virtual/device-type/evcs')
const { trackLocalChanges, createDebouncedSetters } = require('../src/nodes/victron-virtual-dbus-helpers')
const { debounce } = require('../src/services/utils')

// Shape of an ItemsChanged payload item as emitted by dbus-victron-virtual.
function item (path, value) {
  return [path, [['Value', value === null ? ['ai', []] : ['d', value]], ['Text', ['s', String(value)]]]]
}

describe('evcs.controlOutputMessages', () => {
  test('returns one message per changed control path', () => {
    const messages = evcs.controlOutputMessages([item('/StartStop', 1), item('/SetCurrent', 10)])
    expect(messages).toEqual([
      { topic: '/StartStop', payload: 1 },
      { topic: '/SetCurrent', payload: 10 }
    ])
  })

  test('ignores non-control paths', () => {
    expect(evcs.controlOutputMessages([item('/Ac/Power', 7200), item('/Status', 2), item('/Mode', 1)]))
      .toEqual([{ topic: '/Mode', payload: 1 }])
  })

  test.each(['/Mode', '/StartStop', '/AutoStart', '/EnableDisplay', '/SetCurrent', '/MinCurrent', '/MaxCurrent'])('%s is a control path', (path) => {
    expect(evcs.controlOutputMessages([item(path, 1)])).toHaveLength(1)
  })

  test('reports a cleared value as null', () => {
    expect(evcs.controlOutputMessages([item('/SetCurrent', null)])).toEqual([{ topic: '/SetCurrent', payload: null }])
  })
})

describe('evcs.createControlOutputFilter', () => {
  test('passes external changes that differ from the last known value', () => {
    const filter = evcs.createControlOutputFilter({ StartStop: 0 })
    expect(filter([{ topic: '/StartStop', payload: 1 }], false)).toEqual([{ topic: '/StartStop', payload: 1 }])
  })

  test('drops external writes of the last known value', () => {
    const filter = evcs.createControlOutputFilter({ StartStop: 0 })
    expect(filter([{ topic: '/StartStop', payload: 0 }], false)).toEqual([])
  })

  test('drops local changes but remembers their value', () => {
    const filter = evcs.createControlOutputFilter({ SetCurrent: 6 })
    expect(filter([{ topic: '/SetCurrent', payload: 10 }], true)).toEqual([])
    expect(filter([{ topic: '/SetCurrent', payload: 10 }], false)).toEqual([])
    expect(filter([{ topic: '/SetCurrent', payload: 6 }], false)).toEqual([{ topic: '/SetCurrent', payload: 6 }])
  })

  test('drops a repeated external write after reporting it once', () => {
    const filter = evcs.createControlOutputFilter({ Mode: 0 })
    expect(filter([{ topic: '/Mode', payload: 1 }], false)).toHaveLength(1)
    expect(filter([{ topic: '/Mode', payload: 1 }], false)).toEqual([])
  })
})

describe('trackLocalChanges', () => {
  test('marks changes as local only while the wrapped call runs', () => {
    const node = {}
    const seen = []
    const setValuesLocally = jest.fn(() => seen.push(node._applyingLocalChange))
    const wrapped = trackLocalChanges(node, setValuesLocally)

    wrapped({ StartStop: 1 })

    expect(setValuesLocally).toHaveBeenCalledWith({ StartStop: 1 })
    expect(seen).toEqual([true])
    expect(node._applyingLocalChange).toBe(false)
  })

  test('clears the flag when the wrapped call throws', () => {
    const node = {}
    const wrapped = trackLocalChanges(node, () => { throw new Error('Property X not found') })
    expect(() => wrapped({ X: 1 })).toThrow('Property X not found')
    expect(node._applyingLocalChange).toBe(false)
  })
})

// Echo suppression relies on dbus-victron-virtual calling emitCallback synchronously from
// both setValuesLocally and an external SetValue. This guards that assumption.
describe('local vs external writes through dbus-victron-virtual', () => {
  // D-Bus variant as dbus-native delivers it to SetValue
  const variant = (type, value) => [[{ type }], [value]]

  function setup () {
    const exported = {}
    const bus = { exportInterface: jest.fn((iface, path) => { exported[path] = iface }) }
    const node = {}
    const received = []
    const ifaceDesc = {
      name: 'com.victronenergy.evcharger.virtual_test',
      properties: evcs.properties({ evcs_charging_control: true }),
      productType: evcs.productType()
    }
    const iface = { emit: jest.fn(), StartStop: 0, SetCurrent: 6, Mode: 0 }
    const filter = evcs.createControlOutputFilter(iface)
    const { setValuesLocally } = addVictronInterfaces(bus, ifaceDesc, iface, true, (event, data) => {
      if (event !== 'ItemsChanged') return
      received.push(...filter(evcs.controlOutputMessages(data), node._applyingLocalChange))
    })
    node.ifaceDesc = ifaceDesc
    node.setValuesLocally = trackLocalChanges(node, setValuesLocally)
    return { exported, node, received, iface }
  }

  test('an external SetValue is reported', () => {
    const { exported, received } = setup()
    expect(exported['/StartStop'].SetValue(variant('i', 1))).toBe(0)
    expect(received).toEqual([{ topic: '/StartStop', payload: 1 }])
  })

  test('a local write is not reported', () => {
    const { node, received } = setup()
    node.setValuesLocally({ SetCurrent: 10 })
    expect(received).toEqual([])
  })

  test('an external write after a local one is compared with the local value', () => {
    const { exported, node, received } = setup()
    node.setValuesLocally({ SetCurrent: 10 })
    exported['/SetCurrent'].SetValue(variant('d', 10))
    expect(received).toEqual([])
    exported['/SetCurrent'].SetValue(variant('d', 16))
    expect(received).toEqual([{ topic: '/SetCurrent', payload: 16 }])
  })

  test('an external write of the current value is not reported', () => {
    const { exported, received } = setup()
    exported['/StartStop'].SetValue(variant('i', 0))
    expect(received).toEqual([])
  })

  test('a local write of several control paths in one call is not reported', () => {
    const { exported, node, received } = setup()
    node.setValuesLocally({ StartStop: 1, SetCurrent: 10, Mode: 1 })
    expect(received).toEqual([])
    exported['/Mode'].SetValue(variant('i', 1))
    expect(received).toEqual([])
  })

  describe('with debounced node input', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    test('control paths applied after the debounce delay are not reported', () => {
      const { node, received, iface } = setup()
      const { getDebouncedSetter } = createDebouncedSetters(node, debounce, 100)

      getDebouncedSetter('/StartStop')(1)
      getDebouncedSetter('/SetCurrent')(10)
      jest.advanceTimersByTime(100)

      expect(iface).toMatchObject({ StartStop: 1, SetCurrent: 10 })
      expect(node._applyingLocalChange).toBe(false)
      expect(received).toEqual([])
    })
  })
})
