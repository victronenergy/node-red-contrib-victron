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

