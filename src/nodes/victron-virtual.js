const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const dbus = require('dbus-native-victron')
const debug = require('debug')('victron-virtual')

// Import our modular components
const deviceRegistry = require('./victron-virtual/device-registry')
const persistence = require('./victron-virtual/persistence')
const utils = require('./victron-virtual/utils')

// Import device type implementations
const deviceTypes = {
  battery: require('./victron-virtual/device-types/battery'),
  gps: require('./victron-virtual/device-types/gps'),
  grid: require('./victron-virtual/device-types/grid'),
  meteo: require('./victron-virtual/device-types/meteo'),
  motordrive: require('./victron-virtual/device-types/motordrive'),
  pvinverter: require('./victron-virtual/device-types/pvinverter'),
  switch: require('./victron-virtual/device-types/switch'),
  tank: require('./victron-virtual/device-types/tank'),
  temperature: require('./victron-virtual/device-types/temperature')
}

module.exports = function (RED) {
  function VictronVirtualNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

    // Find a persistent storage if available
    const persistentStorage = utils.findPersistentStorage(RED)
    if (persistentStorage) {
      debug(`Using persistent context storage: ${persistentStorage}`)
    } else {
      debug('No file-based context storage found in settings.js. Device states will not persist across restarts.')
    }

    // Default paths to track for all devices
    const pathsToTrack = ['CustomName']
    let settingsKeysToTrack = ['CustomName'] // Track CustomName for all devices

    // Configure dbus connection
    const address = process.env.NODE_RED_DBUS_ADDRESS
      ? process.env.NODE_RED_DBUS_ADDRESS.split(':')
      : null
    if (address && address.length === 2) {
      this.address = `tcp:host=${address[0]},port=${address[1]}`
    }

    // Connect to the dbus
    if (this.address) {
      debug(`Connecting to TCP address ${this.address}.`)
      this.bus = dbus.createClient({
        busAddress: this.address,
        authMethods: ['ANONYMOUS']
      })
    } else {
      this.bus = process.env.DBUS_SESSION_BUS_ADDRESS
        ? dbus.sessionBus()
        : dbus.systemBus()
    }
    
    if (!this.bus) {
      node.warn('Could not connect to the DBus session bus.')
      node.status({
        color: 'red',
        shape: 'dot',
        text: 'Could not connect to the DBus session bus.'
      })
      return
    }

    if (!config.device || config.device === '') {
      node.warn('No device configured')
      node.status({
        color: 'red',
        shape: 'dot',
        text: 'No device configured'
      })
      return
    }

    let serviceName = `com.victronenergy.${config.device}.virtual_${this.id}`
    // For relays, we only add services, setting the serviceName to this (will result in 0x3 code)
    if (config.device === 'relay') {
      serviceName = 'com.victronenergy.settings'
    }

    const interfaceName = serviceName
    const objectPath = `/${serviceName.replace(/\./g, '/')}`

    async function proceed (usedBus) {
      // Check if this device type is supported
      if (!deviceTypes[config.device]) {
        node.warn(`Unsupported device type: ${config.device}`)
        node.status({
          color: 'red',
          shape: 'dot',
          text: `Unsupported device type: ${config.device}`
        })
        return
      }

      const deviceType = deviceTypes[config.device]
      
      // Create interface description and implementation
      const ifaceDesc = {
        name: interfaceName,
        methods: {},
        properties: deviceType.getInterfaceDescription(config),
        signals: {}
      }

      const iface = deviceType.getInterface(config)
      
      // Set common properties
      iface.Status = 0
      iface.Serial = node.id || '-'
      iface.CustomName = config.name || `Virtual ${config.device}`

      // Get device-specific paths to track for persistence
      const pathsToTrack = deviceType.getPathsToTrack(config)
      
      // First we use addSettings to claim a deviceInstance
      const settingsResult = await addSettings(usedBus, [
        {
          path: `/Settings/Devices/virtual_${node.id}/ClassAndVrmInstance`,
          default: `${config.device}:100`,
          type: 's'
        }
      ])

      // Extract device instance from the settings result
      iface.DeviceInstance = utils.extractDeviceInstance(settingsResult)
      
      if (iface.DeviceInstance === null) {
        node.warn('Failed to obtain a valid device instance')
        node.status({
          color: 'red',
          shape: 'dot',
          text: 'Invalid device instance'
        })
        return // Exit early if we couldn't get a valid device instance
      }

      // Set up device-specific configuration
      const setupResult = deviceType.setupDevice(config, iface, ifaceDesc, node, {
        persistentStorage,
        pathsToTrack,
        settingsKeysToTrack
      })

      // Apply default values if configured
      if (config.default_values && config.device !== 'gps') {
        deviceType.applyDefaultValues(iface, config)
      }

      // Set up persistence if available
      if (persistentStorage) {
        persistence.setupAutoPersistence(iface, node, persistentStorage, pathsToTrack)
        const savedData = persistence.loadSavedData(node, persistentStorage)
        if (savedData) {
          utils.applyStateData(iface, savedData, pathsToTrack)
        }
      }

      node.iface = iface
      node.ifaceDesc = ifaceDesc

      // Now we need to actually export our interface on our object
      usedBus.exportInterface(iface, objectPath, ifaceDesc)

      usedBus.requestName(serviceName, 0x4, (err, retCode) => {
        // If there was an error, warn user and fail
        if (err) {
          node.warn(`Could not request service name ${serviceName}, the error was: ${err}.`)
          node.status({
            color: 'red',
            shape: 'dot',
            text: `${err}`
          })
          return
        }

        // Return code 0x1 means we successfully had the name
        // Return code 0x3 means it already exists (which should be fine)
        if (retCode === 1 || retCode === 3) {
          debug(`Successfully requested service name "${serviceName}" (${retCode})`)
        } else {
          /* Other return codes means various errors, check here
          (https://dbus.freedesktop.org/doc/api/html/group__DBusShared.html#ga37a9bc7c6eb11d212bf8d5e5ff3b50f9) for more
          information */
          node.warn(`Failed to request service name "${serviceName} for ${config.device}". Check what return code "${retCode}" means.`)
          node.status({
            color: 'red',
            shape: 'dot',
            text: `Dbus errorcode ${retCode}`
          })
        }
      })

      // Add the required Victron interfaces
      const {
        removeSettings,
        getValue
      } = addVictronInterfaces(usedBus, ifaceDesc, iface)

      node.removeSettings = removeSettings

      // Set node status with device-specific text
      const statusText = deviceType.getStatusText(iface, config)
      node.status({
        fill: 'green',
        shape: 'dot',
        text: `${statusText} (${iface.DeviceInstance})`
      })

      // Register this node instance
      deviceRegistry.registerDevice(node)
      
      // If this is the first node, schedule cleanup of inactive devices
      deviceRegistry.scheduleCleanup(usedBus, removeSettings)
    }

    proceed(this.bus)

    node.on('input', function (msg) {
      // Process incoming messages if needed
    })

    node.on('close', function (done) {
      // Save state if persistent storage is available
      if (persistentStorage && node.iface) {
        const stateData = utils.collectStateData(node.iface, pathsToTrack)
        persistence.saveDeviceState(node, persistentStorage, stateData)
      }

      // Unregister this node instance
      deviceRegistry.unregisterDevice(node)

      // End the dbus connection if this was the last node
      if (deviceRegistry.isLastInstance()) {
        this.bus.connection.end()
      }

      done()
    })
  }

  RED.nodes.registerType('victron-virtual', VictronVirtualNode)
}
