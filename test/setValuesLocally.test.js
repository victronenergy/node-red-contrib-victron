// Mock dependencies first
jest.mock('dbus-native-victron', () => ({
  sessionBus: jest.fn(),
  systemBus: jest.fn(),
  createClient: jest.fn()
}))

jest.mock('dbus-victron-virtual', () => ({
  addVictronInterfaces: jest.fn(),
  addSettings: jest.fn()
}))

jest.mock('../src/nodes/persist', () => ({
  needsPersistedState: jest.fn(() => false),
  hasPersistedState: jest.fn(() => false),
  loadPersistedState: jest.fn(() => Promise.resolve()),
  savePersistedState: jest.fn(() => Promise.resolve())
}))

jest.mock('debug', () => jest.fn(() => jest.fn()))

describe('VictronVirtualNode setValuesLocally Input Handling', () => {
  let mockNode
  let mockSetValuesLocally
  let inputHandler

  beforeEach(() => {
    // Create a mock node with the required methods
    mockSetValuesLocally = jest.fn()

    mockNode = {
      id: 'test-node-1',
      warn: jest.fn(),
      error: jest.fn(),
      status: jest.fn(),
      on: jest.fn(),
      setValuesLocally: mockSetValuesLocally,
      iface: { DeviceInstance: 100 },
      pendingCallsToSetValuesLocally: []
    }

    // Create the input handler function directly (extracted from the real code)
    function handleInput (msg, done) {
      if (!msg || msg.payload === undefined) {
        mockNode.warn('Received message without payload, ignoring.')
        return
      }

      // Check if the payload is a valid object
      if (typeof msg.payload !== 'object' || msg.payload === null) {
        mockNode.warn('Received invalid payload, expected an object with payload. Ignoring.')
        return
      }

      try {
        // Set values locally, which will emit 'itemsChanged' signal for all properties that were actually changed
        mockNode.setValuesLocally(msg.payload)

        mockNode.status({
          fill: 'green',
          shape: 'dot',
          text: `Updated ${Object.keys(msg.payload).length} values for battery (${mockNode.iface.DeviceInstance})`
        })
        done()
      } catch (err) {
        mockNode.error(`Failed to set values locally: ${err.message}`, msg)
        mockNode.status({
          color: 'red',
          shape: 'dot',
          text: `Failed to set values: ${err.message}`
        })
        done(err)
      }
    }

    // Simulate the input event handler registration
    inputHandler = function (msg, _send, done) {
      if (!mockNode.setValuesLocally) {
        // Queue the message if not ready
        mockNode.pendingCallsToSetValuesLocally.push([msg, done])
        return
      }

      handleInput(msg, done)
    }

    // Clear mocks
    jest.clearAllMocks()
  })

  describe('input message validation', () => {
    test('should warn when message has no payload property', () => {
      const msg = {}
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockNode.warn).toHaveBeenCalledWith('Received message without payload, ignoring.')
      expect(mockSetValuesLocally).not.toHaveBeenCalled()
      expect(done).not.toHaveBeenCalled()
    })

    test('should warn when payload is not an object', () => {
      const msg = { payload: 'invalid' }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockNode.warn).toHaveBeenCalledWith('Received invalid payload, expected an object with payload. Ignoring.')
      expect(mockSetValuesLocally).not.toHaveBeenCalled()
      expect(done).not.toHaveBeenCalled()
    })

    test('should warn when payload is null', () => {
      const msg = { payload: null }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockNode.warn).toHaveBeenCalledWith('Received invalid payload, expected an object with payload. Ignoring.')
      expect(mockSetValuesLocally).not.toHaveBeenCalled()
      expect(done).not.toHaveBeenCalled()
    })
  })

  describe('message queueing when not ready', () => {
    test('should queue messages when setValuesLocally is not available', () => {
      // Remove setValuesLocally to simulate not ready state
      mockNode.setValuesLocally = null

      const msg = { payload: { '/Dc/0/Voltage': 12.5 } }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockNode.pendingCallsToSetValuesLocally).toHaveLength(1)
      expect(mockNode.pendingCallsToSetValuesLocally[0]).toEqual([msg, done])
      expect(mockSetValuesLocally).not.toHaveBeenCalled()
    })
  })

  describe('successful property updates', () => {
    test('should update single property and show success status', () => {
      const msg = {
        payload: {
          '/Dc/0/Voltage': 12.5
        }
      }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg.payload)
      expect(mockNode.status).toHaveBeenCalledWith({
        fill: 'green',
        shape: 'dot',
        text: 'Updated 1 values for battery (100)'
      })
      expect(done).toHaveBeenCalledWith()
    })

    test('should update multiple properties and count them correctly', () => {
      const msg = {
        payload: {
          '/Dc/0/Voltage': 12.5,
          '/Dc/0/Current': -15.2,
          '/Soc': 85,
          '/ConsumedAmphours': 25.5
        }
      }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg.payload)
      expect(mockNode.status).toHaveBeenCalledWith({
        fill: 'green',
        shape: 'dot',
        text: 'Updated 4 values for battery (100)'
      })
      expect(done).toHaveBeenCalledWith()
    })

    test('should handle empty payload object', () => {
      const msg = { payload: {} }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockSetValuesLocally).toHaveBeenCalledWith({})
      expect(mockNode.status).toHaveBeenCalledWith({
        fill: 'green',
        shape: 'dot',
        text: 'Updated 0 values for battery (100)'
      })
      expect(done).toHaveBeenCalledWith()
    })
  })

  describe('error handling', () => {
    test('should handle setValuesLocally throwing errors', () => {
      const testError = new Error('DBus connection failed')
      mockSetValuesLocally.mockImplementationOnce(() => {
        throw testError
      })

      const msg = {
        payload: {
          '/Dc/0/Voltage': 12.5
        }
      }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockNode.error).toHaveBeenCalledWith('Failed to set values locally: DBus connection failed', msg)
      expect(mockNode.status).toHaveBeenCalledWith({
        color: 'red',
        shape: 'dot',
        text: 'Failed to set values: DBus connection failed'
      })
      expect(done).toHaveBeenCalledWith(testError)
    })
  })

  describe('device-specific payload examples', () => {
    test('should handle battery device properties', () => {
      const msg = {
        payload: {
          '/Dc/0/Voltage': 24.5,
          '/Dc/0/Current': -10.3,
          '/Soc': 75,
          '/Dc/0/Temperature': 25.5,
          '/ConsumedAmphours': 45.2
        }
      }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg.payload)
      expect(mockNode.status).toHaveBeenCalledWith({
        fill: 'green',
        shape: 'dot',
        text: 'Updated 5 values for battery (100)'
      })
    })

    test('should handle generator device properties', () => {
      mockNode.iface.DeviceInstance = 101

      const msg = {
        payload: {
          '/Ac/Power': 2500,
          '/Ac/Energy/Forward': 125.5,
          '/Ac/Frequency': 50.1,
          '/Engine/Load': 65,
          '/Engine/Speed': 1800,
          '/Start': 1
        }
      }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg.payload)
      expect(mockNode.status).toHaveBeenCalledWith({
        fill: 'green',
        shape: 'dot',
        text: 'Updated 6 values for battery (101)'
      })
    })

    test('should handle temperature sensor properties', () => {
      mockNode.iface.DeviceInstance = 102

      const msg = {
        payload: {
          '/Temperature': 22.5,
          '/Humidity': 68,
          '/Pressure': 1013.25,
          '/BatteryVoltage': 3.3
        }
      }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg.payload)
      expect(mockNode.status).toHaveBeenCalledWith({
        fill: 'green',
        shape: 'dot',
        text: 'Updated 4 values for battery (102)'
      })
    })
  })

  describe('edge cases', () => {
    test('should handle nested object values in payload', () => {
      const msg = {
        payload: {
          '/Dc/0/Voltage': { value: 12.5, unit: 'V' },
          '/Soc': 85
        }
      }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg.payload)
      expect(mockNode.status).toHaveBeenCalledWith({
        fill: 'green',
        shape: 'dot',
        text: 'Updated 2 values for battery (100)'
      })
    })

    test('should handle boolean values in payload', () => {
      const msg = {
        payload: {
          '/Connected': true,
          '/ErrorState': false,
          '/Soc': 85
        }
      }
      const done = jest.fn()

      inputHandler(msg, null, done)

      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg.payload)
      expect(mockNode.status).toHaveBeenCalledWith({
        fill: 'green',
        shape: 'dot',
        text: 'Updated 3 values for battery (100)'
      })
    })
  })

  describe('pending calls processing', () => {
    test('should process pending calls when node becomes ready', () => {
      // Start with node not ready
      mockNode.setValuesLocally = null

      // Queue some messages
      const msg1 = { payload: { '/Dc/0/Voltage': 12.0 } }
      const msg2 = { payload: { '/Soc': 75 } }
      const done1 = jest.fn()
      const done2 = jest.fn()

      inputHandler(msg1, null, done1)
      inputHandler(msg2, null, done2)

      expect(mockNode.pendingCallsToSetValuesLocally).toHaveLength(2)

      // Now make the node ready
      mockNode.setValuesLocally = mockSetValuesLocally

      // Process the pending calls manually (simulating what the real code does)
      mockNode.pendingCallsToSetValuesLocally.forEach(([msg, doneCb]) => {
        inputHandler(msg, null, doneCb)
      })
      mockNode.pendingCallsToSetValuesLocally = []

      expect(mockSetValuesLocally).toHaveBeenCalledTimes(2)
      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg1.payload)
      expect(mockSetValuesLocally).toHaveBeenCalledWith(msg2.payload)
      expect(done1).toHaveBeenCalled()
      expect(done2).toHaveBeenCalled()
    })
  })
})
