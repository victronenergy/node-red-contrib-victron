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
