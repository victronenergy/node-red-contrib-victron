// test/e2e/config.js
module.exports = {
  // Node-RED instance config
  nodeRed: {
    port: process.env.E2E_PORT || 1881,
    host: process.env.E2E_HOST || 'localhost',
    adminAuth: false, // Disable auth for tests
    logging: { console: { level: 'warn' } }
  },

  // Device endpoint configuration - configurable per test environment
  devices: {
    // For local development with dbus over TCP
    tcp: {
      dbusAddress: process.env.DBUS_TCP_ADDRESS || 'tcp:host=venus.local,port=78',
      clientConfig: {
        host: process.env.VICTRON_HOST || 'venus.local',
        port: process.env.VICTRON_PORT || 78
      }
    },
    
    // For GX device testing with local dbus
    local: {
      dbusAddress: 'unix:path=/var/run/dbus/system_bus_socket',
      clientConfig: {
        // Local dbus connection
      }
    },

    // Mock/test dbus for CI
    mock: {
      dbusAddress: 'mock://test-dbus',
      clientConfig: {
        mock: true
      }
    }
  },

  // Get current device config based on environment
  getCurrentDevice() {
    const deviceType = process.env.E2E_DEVICE || 'tcp'
    return this.devices[deviceType]
  },

  // Browser configuration
  browser: {
    headless: !process.env.HEADED,
    slowMo: process.env.SLOW_MO || 0,
    devtools: process.env.DEVTOOLS === 'true'
  },

  // Test flow templates
  flows: {
    victronInput: {
      id: 'test-victron-input',
      type: 'victron-input-battery',
      name: 'Test Battery Input',
      service: 'com.victronenergy.battery.ttyUSB0',
      path: '/Soc',
      clientId: 'victron-client-test'
    },

    victronVirtual: {
      id: 'test-victron-virtual', 
      type: 'victron-virtual',
      name: 'Test Virtual Battery',
      device: 'battery',
      clientId: 'victron-client-test'
    },

    victronClient: {
      id: 'victron-client-test',
      type: 'victron-client',
      name: 'Test Victron Client'
    }
  }
}
