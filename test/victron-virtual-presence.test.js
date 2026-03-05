/* eslint-env jest */

const { makeSetPresence } = require('../src/nodes/victron-virtual/helpers')

describe('makeSetPresence', () => {
  function createMockNode (presenceConnected = true) {
    return {
      presenceConnected,
      serviceName: 'com.victronenergy.battery.virtual_test',
      status: jest.fn(),
      bus: {
        requestName: jest.fn(),
        releaseName: jest.fn()
      }
    }
  }

  const text = 'Virtual battery'
  const iface = { DeviceInstance: 100 }

  describe('disconnect', () => {
    test('releases the DBus name when connected', () => {
      const node = createMockNode(true)
      node.bus.releaseName.mockImplementation((_name, cb) => cb(null))
      const done = jest.fn()

      makeSetPresence(node, text, iface)(false, done)

      expect(node.bus.releaseName).toHaveBeenCalledWith(node.serviceName, expect.any(Function))
      expect(node.presenceConnected).toBe(false)
      expect(node.status).toHaveBeenCalledWith({ fill: 'grey', shape: 'ring', text: 'Virtual battery (100) - offline' })
      expect(done).toHaveBeenCalled()
    })

    test('does not change state when releaseName errors', () => {
      const node = createMockNode(true)
      node.bus.releaseName.mockImplementation((_name, cb) => cb(new Error('bus error')))
      const done = jest.fn()

      makeSetPresence(node, text, iface)(false, done)

      expect(node.presenceConnected).toBe(true)
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })

    test('is a no-op when already disconnected', () => {
      const node = createMockNode(false)
      const done = jest.fn()

      makeSetPresence(node, text, iface)(false, done)

      expect(node.bus.releaseName).not.toHaveBeenCalled()
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })
  })

  describe('connect', () => {
    test('requests the DBus name when disconnected', () => {
      const node = createMockNode(false)
      node.bus.requestName.mockImplementation((_name, _flags, cb) => cb(null, 1))
      const done = jest.fn()

      makeSetPresence(node, text, iface)(true, done)

      expect(node.bus.requestName).toHaveBeenCalledWith(node.serviceName, 0x4, expect.any(Function))
      expect(node.presenceConnected).toBe(true)
      expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'Virtual battery (100)' })
      expect(done).toHaveBeenCalled()
    })

    test('also accepts retCode 3 (name already owned)', () => {
      const node = createMockNode(false)
      node.bus.requestName.mockImplementation((_name, _flags, cb) => cb(null, 3))
      const done = jest.fn()

      makeSetPresence(node, text, iface)(true, done)

      expect(node.presenceConnected).toBe(true)
      expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'Virtual battery (100)' })
      expect(done).toHaveBeenCalled()
    })

    test('does not change state when requestName errors', () => {
      const node = createMockNode(false)
      node.bus.requestName.mockImplementation((_name, _flags, cb) => cb(new Error('bus error'), null))
      const done = jest.fn()

      makeSetPresence(node, text, iface)(true, done)

      expect(node.presenceConnected).toBe(false)
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })

    test('does not change state when requestName returns unexpected retCode', () => {
      const node = createMockNode(false)
      node.bus.requestName.mockImplementation((_name, _flags, cb) => cb(null, 2))
      const done = jest.fn()

      makeSetPresence(node, text, iface)(true, done)

      expect(node.presenceConnected).toBe(false)
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })

    test('is a no-op when already connected', () => {
      const node = createMockNode(true)
      const done = jest.fn()

      makeSetPresence(node, text, iface)(true, done)

      expect(node.bus.requestName).not.toHaveBeenCalled()
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })
  })
})
