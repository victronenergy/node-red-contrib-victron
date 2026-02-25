/* eslint-env jest */

describe('victron-virtual presence toggle (msg.connected)', () => {
  function createMockNode (presenceConnected = true) {
    const node = {
      presenceConnected,
      serviceName: 'com.victronenergy.battery.virtual_test',
      status: jest.fn(),
      bus: {
        requestName: jest.fn(),
        releaseName: jest.fn()
      }
    }
    return node
  }

  const text = 'Virtual battery'
  const iface = { DeviceInstance: 100 }

  function makeSetPresence (node) {
    return function setPresence (connected, onDone) {
      const statusText = `${text} (${iface.DeviceInstance})`
      if (connected && !node.presenceConnected) {
        node.bus.requestName(node.serviceName, 0x4, (err, retCode) => {
          if (!err && (retCode === 1 || retCode === 3)) {
            node.presenceConnected = true
            node.status({ fill: 'green', shape: 'dot', text: statusText })
          }
          onDone()
        })
      } else if (!connected && node.presenceConnected) {
        node.bus.releaseName(node.serviceName, (err) => {
          if (!err) {
            node.presenceConnected = false
            node.status({ fill: 'grey', shape: 'ring', text: `${statusText} — offline` })
          }
          onDone()
        })
      } else {
        onDone()
      }
    }
  }

  describe('setPresence — disconnect', () => {
    test('releases the DBus name when connected', () => {
      const node = createMockNode(true)
      const setPresence = makeSetPresence(node)
      node.bus.releaseName.mockImplementation((_name, cb) => cb(null))

      const done = jest.fn()
      setPresence(false, done)

      expect(node.bus.releaseName).toHaveBeenCalledWith(node.serviceName, expect.any(Function))
      expect(node.presenceConnected).toBe(false)
      expect(node.status).toHaveBeenCalledWith({ fill: 'grey', shape: 'ring', text: 'Virtual battery (100) — offline' })
      expect(done).toHaveBeenCalled()
    })

    test('does not change state when releaseName errors', () => {
      const node = createMockNode(true)
      const setPresence = makeSetPresence(node)
      node.bus.releaseName.mockImplementation((_name, cb) => cb(new Error('bus error')))

      const done = jest.fn()
      setPresence(false, done)

      expect(node.presenceConnected).toBe(true)
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })

    test('is a no-op when already disconnected', () => {
      const node = createMockNode(false)
      const setPresence = makeSetPresence(node)

      const done = jest.fn()
      setPresence(false, done)

      expect(node.bus.releaseName).not.toHaveBeenCalled()
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })
  })

  describe('setPresence — connect', () => {
    test('requests the DBus name when disconnected', () => {
      const node = createMockNode(false)
      const setPresence = makeSetPresence(node)
      node.bus.requestName.mockImplementation((_name, _flags, cb) => cb(null, 1))

      const done = jest.fn()
      setPresence(true, done)

      expect(node.bus.requestName).toHaveBeenCalledWith(node.serviceName, 0x4, expect.any(Function))
      expect(node.presenceConnected).toBe(true)
      expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'Virtual battery (100)' })
      expect(done).toHaveBeenCalled()
    })

    test('also accepts retCode 3 (name already owned)', () => {
      const node = createMockNode(false)
      const setPresence = makeSetPresence(node)
      node.bus.requestName.mockImplementation((_name, _flags, cb) => cb(null, 3))

      const done = jest.fn()
      setPresence(true, done)

      expect(node.presenceConnected).toBe(true)
      expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'Virtual battery (100)' })
      expect(done).toHaveBeenCalled()
    })

    test('does not change state when requestName errors', () => {
      const node = createMockNode(false)
      const setPresence = makeSetPresence(node)
      node.bus.requestName.mockImplementation((_name, _flags, cb) => cb(new Error('bus error'), null))

      const done = jest.fn()
      setPresence(true, done)

      expect(node.presenceConnected).toBe(false)
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })

    test('does not change state when requestName returns unexpected retCode', () => {
      const node = createMockNode(false)
      const setPresence = makeSetPresence(node)
      node.bus.requestName.mockImplementation((_name, _flags, cb) => cb(null, 2))

      const done = jest.fn()
      setPresence(true, done)

      expect(node.presenceConnected).toBe(false)
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })

    test('is a no-op when already connected', () => {
      const node = createMockNode(true)
      const setPresence = makeSetPresence(node)

      const done = jest.fn()
      setPresence(true, done)

      expect(node.bus.requestName).not.toHaveBeenCalled()
      expect(node.status).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalled()
    })
  })

  describe('handleInput — msg.connected routing', () => {
    function simulateHandleInput (node, msg, done) {
      // Mirrors the relevant part of handleInput in index.js
      const userSetConnected = msg.connected !== undefined
      if (!userSetConnected) {
        msg.connected = node.presenceConnected
      }
      if (userSetConnected) {
        node.setPresence(!!msg.connected, done)
        return true // indicates early return
      }
      return false
    }

    test('msg.connected = false routes to setPresence and returns early', () => {
      const node = createMockNode(true)
      node.setPresence = jest.fn((_connected, done) => done())
      const done = jest.fn()

      const earlyReturn = simulateHandleInput(node, { connected: false }, done)

      expect(earlyReturn).toBe(true)
      expect(node.setPresence).toHaveBeenCalledWith(false, done)
      expect(done).toHaveBeenCalled()
    })

    test('msg.connected = true routes to setPresence and returns early', () => {
      const node = createMockNode(false)
      node.setPresence = jest.fn((_connected, done) => done())
      const done = jest.fn()

      const earlyReturn = simulateHandleInput(node, { connected: true }, done)

      expect(earlyReturn).toBe(true)
      expect(node.setPresence).toHaveBeenCalledWith(true, done)
    })

    test('msg.connected = false with payload still returns early (payload ignored)', () => {
      const node = createMockNode(true)
      node.setPresence = jest.fn((_connected, done) => done())
      const done = jest.fn()

      const earlyReturn = simulateHandleInput(node, { connected: false, payload: { Soc: 85 } }, done)

      expect(earlyReturn).toBe(true)
      expect(node.setPresence).toHaveBeenCalledWith(false, done)
    })

    test('msg without connected falls through to normal processing', () => {
      const node = createMockNode(true)
      node.setPresence = jest.fn()
      const done = jest.fn()

      const earlyReturn = simulateHandleInput(node, { payload: { Soc: 85 } }, done)

      expect(earlyReturn).toBe(false)
      expect(node.setPresence).not.toHaveBeenCalled()
    })

    test('stamps msg.connected = true on normal message when connected', () => {
      const node = createMockNode(true)
      node.setPresence = jest.fn()
      const msg = { payload: { Soc: 85 } }

      simulateHandleInput(node, msg, jest.fn())

      expect(msg.connected).toBe(true)
    })

    test('stamps msg.connected = false on normal message when disconnected', () => {
      const node = createMockNode(false)
      node.setPresence = jest.fn()
      const msg = { payload: { Soc: 85 } }

      simulateHandleInput(node, msg, jest.fn())

      expect(msg.connected).toBe(false)
    })

    test('does not overwrite explicit msg.connected = false', () => {
      const node = createMockNode(true) // currently connected
      node.setPresence = jest.fn((_c, done) => done())
      const msg = { connected: false }

      simulateHandleInput(node, msg, jest.fn())

      expect(msg.connected).toBe(false)
    })

    test('msg.connected = null falls through (undefined check is strict)', () => {
      const node = createMockNode(true)
      node.setPresence = jest.fn()
      const done = jest.fn()

      const earlyReturn = simulateHandleInput(node, { connected: null }, done)

      // null !== undefined, so it routes to setPresence with !!null = false
      expect(earlyReturn).toBe(true)
      expect(node.setPresence).toHaveBeenCalledWith(false, done)
    })
  })

  describe('start_disconnected config', () => {
    function simulateStartDisconnected (config, node, serviceName, text, iface) {
      // Mirrors the requestName callback logic when start_disconnected is set
      node.serviceName = serviceName
      if (config.start_disconnected) {
        node.bus.releaseName(node.serviceName, () => {
          node.presenceConnected = false
          node.status({ fill: 'grey', shape: 'ring', text: `${text} (${iface.DeviceInstance}) — offline` })
        })
      } else {
        node.presenceConnected = true
        node.status({ fill: 'green', shape: 'dot', text: `${text} (${iface.DeviceInstance})` })
      }
    }

    test('releases name and sets grey status when start_disconnected is true', () => {
      const node = createMockNode(false)
      node.bus.releaseName.mockImplementation((_name, cb) => cb())

      simulateStartDisconnected({ start_disconnected: true }, node, node.serviceName, text, iface)

      expect(node.bus.releaseName).toHaveBeenCalled()
      expect(node.presenceConnected).toBe(false)
      expect(node.status).toHaveBeenCalledWith({ fill: 'grey', shape: 'ring', text: 'Virtual battery (100) — offline' })
    })

    test('sets presenceConnected and green status when start_disconnected is false', () => {
      const node = createMockNode(false)

      simulateStartDisconnected({ start_disconnected: false }, node, node.serviceName, text, iface)

      expect(node.bus.releaseName).not.toHaveBeenCalled()
      expect(node.presenceConnected).toBe(true)
      expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'Virtual battery (100)' })
    })

    test('sets presenceConnected and green status when start_disconnected is absent', () => {
      const node = createMockNode(false)

      simulateStartDisconnected({}, node, node.serviceName, text, iface)

      expect(node.bus.releaseName).not.toHaveBeenCalled()
      expect(node.presenceConnected).toBe(true)
    })
  })
})
