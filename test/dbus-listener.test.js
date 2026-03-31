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
})
