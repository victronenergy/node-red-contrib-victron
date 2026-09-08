const VictronClient = require('../src/services/victron-client');

describe('victron-client', () => {

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('responds to publish()', async () => {

    const client = new VictronClient('mock-client-id', {
      enablePolling: false
    });

    const mockIface = 'com.some.path';
    const mockPath = '/DeviceInstance';
    const mockValue = '12345';

    // we mock the dbus client. We then expect client.publish() to call setValue on the dbus client
    const mockDbusClient = {
      setValue: jest.fn((iface, path, value, callback) => {
        if (iface === mockIface && path === mockPath && value === mockValue) {
          callback(null);
        } else {
          console.error(`Unexpected call to setValue: ${iface}: ${path} = ${value}`);
          callback(new Error('Invalid path or value'));
        }
      }),
    }

    await client.connect({
      dbusClient: mockDbusClient,
    });

    // as the dbusClient is not connected, there is no cache content yet. By faking
    // the cache content, we avoid a console warning.
    client.system.cache[mockIface] = {}

    await new Promise((resolve, reject) => {
      client.publish(mockIface, mockPath, mockValue, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // we expect the dbus client to have been called with the correct parameters. Previously,
    // setValue would not have been called, because the dbus client was not connected.
    expect(mockDbusClient.setValue).toHaveBeenCalledWith('com.some.path', mockPath, mockValue, expect.any(Function));

  })

})

describe('saveToCache - stale no-trail entry cleanup', () => {
  let client

  beforeEach(() => {
    jest.useFakeTimers()
    client = new VictronClient('mock-client-id', { enablePolling: false })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('removes stale no-trail entry when a trail entry is saved for the same service', () => {
    // Simulate the stale no-trail entry created during _initService async window
    client.system.cache['com.victronenergy.generator'] = { '/State': 0 }

    // Simulate _requestRoot completing with the correct device instance
    client.saveToCache({
      senderName: 'com.victronenergy.generator',
      path: '/State',
      value: 0,
      deviceInstance: 1
    })

    expect(client.system.cache['com.victronenergy.generator']).toBeUndefined()
    expect(client.system.cache['com.victronenergy.generator/1']).toBeDefined()
  })

  it('does not remove trail entries when saving a no-trail entry', () => {
    // Services without device instances (e.g. settings) must not lose trail entries
    client.system.cache['com.victronenergy.generator/0'] = { '/State': 0 }

    client.saveToCache({
      senderName: 'com.victronenergy.generator',
      path: '/State',
      value: 1,
      deviceInstance: null
    })

    expect(client.system.cache['com.victronenergy.generator/0']).toBeDefined()
    expect(client.system.cache['com.victronenergy.generator']).toBeDefined()
  })

  it('treats undefined deviceInstance as no suffix (loose == null, not strict === null)', () => {
    // During _initService's async window, msg.deviceInstance is undefined (not null).
    // Strict === null would produce trail '/undefined'; loose == null correctly gives ''.
    client.saveToCache({
      senderName: 'com.victronenergy.generator',
      path: '/State',
      value: 0,
      deviceInstance: undefined
    })

    expect(client.system.cache['com.victronenergy.generator/undefined']).toBeUndefined()
    expect(client.system.cache['com.victronenergy.generator']).toBeDefined()
  })

  it('converts empty-array D-Bus null values to null in cache', () => {
    client.saveToCache({
      senderName: 'com.victronenergy.battery',
      path: '/Relay/0/State',
      value: [],
      deviceInstance: 0
    })
    expect(client.system.cache['com.victronenergy.battery/0']['/Relay/0/State']).toBeNull()
  })

  it('does not delete anything when no stale entry exists', () => {
    client.saveToCache({
      senderName: 'com.victronenergy.generator',
      path: '/State',
      value: 0,
      deviceInstance: 0
    })

    expect(client.system.cache['com.victronenergy.generator']).toBeUndefined()
    expect(client.system.cache['com.victronenergy.generator/0']).toBeDefined()
  })
})

