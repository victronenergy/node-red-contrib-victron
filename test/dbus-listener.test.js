const VictronDbusListener = require('../src/services/dbus-listener')

describe('VictronDbusListener', () => {
  let listener

  beforeEach(() => {
    listener = new VictronDbusListener('the-address', {})
  })

  test('initializes with correct properties', () => {
    expect(listener.address).toBe('the-address')
  })

  describe('_initService', () => {
    beforeEach(() => {
      listener.bus = {
        invoke: jest.fn((_params, callback) => {
          setTimeout(() => {
            callback(null, [null, ['the-device-instance']])
          }, 10)
        })
      }
      listener._requestRoot = jest.fn()
    })

    test('happy path, we request the deviceInstance and store it', async () => {
      await listener._initService('the-owner', 'the-name')
      expect(listener.services['the-owner'].deviceInstance).toBe('the-device-instance')
    })

    test('service "com.victronenergy.settings" won\'t get a deviceInstance', async () => {
      await listener._initService('the-other-owner', 'com.victronenergy.settings')
      expect(listener.services['the-other-owner'].deviceInstance).toBe(null)
    })

    test('service "com.victronenergy.platform" won\'t get a deviceInstance', async () => {
      await listener._initService('the-platform-owner', 'com.victronenergy.platform')
      expect(listener.services['the-platform-owner'].deviceInstance).toBe(null)
    })

    test('service "com.victronenergy.system" won\'t get a deviceInstance', async () => {
      await listener._initService('the-system-owner', 'com.victronenergy.system')
      expect(listener.services['the-system-owner'].deviceInstance).toBe(null)
    })

    test('service "com.victronenergy.dynamicess" won\'t get a deviceInstance', async () => {
      await listener._initService('the-dynamicess-owner', 'com.victronenergy.dynamicess')
      expect(listener.services['the-dynamicess-owner'].deviceInstance).toBe(null)
    })
  })

  describe('_requestRoot singleton service handling', () => {
    let capturedMessages

    beforeEach(() => {
      capturedMessages = null
      listener.messageHandler = (msgs) => { capturedMessages = msgs }
      // GetItems returns /DeviceInstance: 0 plus one other path
      listener.bus = {
        invoke: jest.fn((_params, callback) => {
          callback(null, [
            ['/DeviceInstance', [['Value', ['i', [0]]]]],
            ['/Version', [['Value', ['s', ['1.0']]]]]
          ])
        })
      }
    })

    test.each([
      'com.victronenergy.platform',
      'com.victronenergy.system',
      'com.victronenergy.dynamicess'
    ])('%s uses null deviceInstance even when GetItems returns /DeviceInstance 0', async (serviceName) => {
      const service = { name: serviceName, deviceInstance: null }
      await listener._requestRoot(service)
      expect(capturedMessages).not.toBeNull()
      capturedMessages.forEach(msg => {
        expect(msg.deviceInstance).toBeNull()
      })
    })

    test('non-singleton service uses deviceInstance from GetItems data', async () => {
      const service = { name: 'com.victronenergy.battery', deviceInstance: null }
      await listener._requestRoot(service)
      expect(capturedMessages).not.toBeNull()
      capturedMessages.forEach(msg => {
        expect(msg.deviceInstance).toBe(0)
      })
    })
  })

  describe('_requestRoot does not mutate service.deviceInstance for singleton services', () => {
    beforeEach(() => {
      listener.messageHandler = () => {}
      listener.bus = {
        invoke: jest.fn((_params, callback) => {
          callback(null, [
            ['/DeviceInstance', [['Value', ['i', [0]]]]],
            ['/Version', [['Value', ['s', ['1.0']]]]]
          ])
        })
      }
    })

    test.each([
      'com.victronenergy.platform',
      'com.victronenergy.system',
      'com.victronenergy.dynamicess'
    ])('%s does not set service.deviceInstance from GetItems data', async (serviceName) => {
      const service = { name: serviceName, deviceInstance: null }
      await listener._requestRoot(service)
      expect(service.deviceInstance).toBeNull()
    })

    test('non-singleton service.deviceInstance is updated from GetItems data', async () => {
      const service = { name: 'com.victronenergy.battery', deviceInstance: null }
      await listener._requestRoot(service)
      expect(service.deviceInstance).toBe(0)
    })
  })
})
