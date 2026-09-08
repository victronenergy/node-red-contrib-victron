const VictronDbusListener = require('../src/services/dbus-listener')

describe('VictronDbusListener', () => {
  let listener

  beforeEach(() => {
    listener = new VictronDbusListener('the-address', {})
  })

  test('initializes with correct properties', () => {
    expect(listener.address).toBe('the-address')
  })

  test('initServiceDenylist does not exclude com.victronenergy.shelly (regression)', () => {
    expect(VictronDbusListener.initServiceDenylist).not.toContain('com.victronenergy.shelly')
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

    test('does not throw when the service disconnects before GetValue resolves (regression)', async () => {
      let invokeCallback
      listener.bus = {
        invoke: jest.fn((_params, callback) => {
          invokeCallback = callback
        })
      }

      const initPromise = listener._initService('the-owner', 'the-name')

      // simulate NameOwnerChanged deleting the service while GetValue is still in flight
      delete listener.services['the-owner']

      invokeCallback(new Error('NoReply'), null)

      await expect(initPromise).resolves.not.toThrow()
      expect(listener.services['the-owner']).toBeUndefined()
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

  describe('_signalRecieve NameOwnerChanged (service removal)', () => {
    let eventHandler

    beforeEach(() => {
      eventHandler = jest.fn()
      listener = new VictronDbusListener('the-address', { eventHandler })
    })

    test('a service losing its name owner fires a DELETE event and removes it from services', () => {
      listener.services[':1.42'] = {
        name: 'com.victronenergy.heatpump.shelly_D885AC1B38F4_0',
        deviceInstance: 61
      }

      listener._signalRecieve({
        interface: 'org.freedesktop.DBus',
        member: 'NameOwnerChanged',
        body: ['com.victronenergy.heatpump.shelly_D885AC1B38F4_0', ':1.42', '']
      })

      expect(eventHandler).toHaveBeenCalledWith('DELETE', 'com.victronenergy.heatpump.shelly_D885AC1B38F4_0')
      expect(eventHandler).toHaveBeenCalledWith('DELETE', 'com.victronenergy.heatpump/61')
      expect(listener.services[':1.42']).toBeUndefined()
    })

    test('a service gaining a name owner fires an INITIALIZE event', () => {
      listener._initService = jest.fn()

      listener._signalRecieve({
        interface: 'org.freedesktop.DBus',
        member: 'NameOwnerChanged',
        body: ['com.victronenergy.heatpump.shelly_D885AC1B38F4_0', '', ':1.42']
      })

      expect(listener._initService).toHaveBeenCalledWith(':1.42', 'com.victronenergy.heatpump.shelly_D885AC1B38F4_0')
      expect(eventHandler).toHaveBeenCalledWith('INITIALIZE', 'com.victronenergy.heatpump.shelly_D885AC1B38F4_0')
    })
  })

  describe('_requestRoot null value handling', () => {
    it('passes null-valued paths to messageHandler so they are cached for the dropdown', async () => {
      const capturedMessages = []
      listener.messageHandler = (msgs) => capturedMessages.push(...msgs)
      listener.services['the-owner'] = { name: 'com.victronenergy.battery', deviceInstance: 1 }
      listener.bus = {
        invoke: jest.fn((_params, callback) => {
          callback(null, [
            ['/DeviceInstance', [['Value', ['i', [1]]]]],
            ['/Soc', [['Value', ['i', [75]]]]],
            ['/NullPath', [['Value', ['n', [null]]]]]
          ])
        })
      }

      await listener._requestRoot({ name: 'com.victronenergy.battery', deviceInstance: 1 })

      const paths = capturedMessages.map(m => m.path)
      expect(paths).toContain('/Soc')
      expect(paths).toContain('/NullPath')
      expect(capturedMessages.find(m => m.path === '/NullPath').value).toBeNull()
    })
  })
})
