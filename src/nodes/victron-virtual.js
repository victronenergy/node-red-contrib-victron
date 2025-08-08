const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const { needsPersistedState, hasPersistedState, loadPersistedState, savePersistedState } = require('./persist')
const dbus = require('dbus-native-victron')
const debug = require('debug')('victron-virtual')
const debugInput = require('debug')('victron-virtual:input')
const debugConnection = require('debug')('victron-virtual:connection')

const { getDeviceConfig } = require('./victron-virtual/device-types')
const { createIfaceDesc, createIface } = require('./victron-virtual/utils')

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION (PREVENTING CRASH) ===')
  console.error('Promise:', promise)
  console.error('Reason:', reason)
  console.error('Reason type:', typeof reason)
  console.error('Is array:', Array.isArray(reason))
  if (Array.isArray(reason)) {
    console.error('Array contents:', JSON.stringify(reason, null, 2))
  }
  console.error('Stack trace:')
  console.trace()
  console.error('=== END DEBUG ===')
})

function getIfaceDesc (dev) {
  const actualDev = dev === 'generator' ? 'genset' : dev
  
  const deviceConfig = getDeviceConfig(actualDev)
  if (deviceConfig) {
    return createIfaceDesc(actualDev, deviceConfig.properties)
  }
  
  return {}
}

function getIface (dev) {
  const actualDev = dev === 'generator' ? 'genset' : dev
  
  const deviceConfig = getDeviceConfig(actualDev)
  if (deviceConfig) {
    return createIface(actualDev, deviceConfig.properties)
  }
  
  return {
    emit: function () {}
  }
}

module.exports = function (RED) {
  // Shared state across all instances
  let hasRunOnce = false
  let globalTimeoutHandle = null
  const nodeInstances = new Set()

  function VictronVirtualNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

    const address = process.env.NODE_RED_DBUS_ADDRESS
      ? process.env.NODE_RED_DBUS_ADDRESS.split(':')
      : null
    if (address && address.length === 2) {
      this.address = `tcp:host=${address[0]},port=${address[1]}`
    }

    node.pendingCallsToSetValuesLocally = []

    function handleInput (msg, done) {
      if (!msg || !msg.payload) {
        node.warn('Received message without payload, ignoring.')
        return
      }

      // Check if the payload is a valid object
      if (typeof msg.payload !== 'object' || msg.payload === null) {
        node.warn('Received invalid payload, expected an object with payload. Ignoring.')
        return
      }

      try {
        // Set values locally, which will emit 'itemsChanged' signal for all properties that were actually changed
        debugInput(`Setting values locally for node ${node.id}:`, msg.payload)
        node.setValuesLocally(msg.payload)

        node.status({
          fill: 'green',
          shape: 'dot',
          text: `Updated ${Object.keys(msg.payload).length} values for ${config.device} (${node.iface.DeviceInstance})`
        })
        done()
      } catch (err) {
        node.error(`Failed to set values locally: ${err.message}`, msg)
        node.status({
          color: 'red',
          shape: 'dot',
          text: `Failed to set values: ${err.message}`
        })
        done(err)
      }
    }

    this.on('input', function (msg, _send, done) {
      if (!node.setValuesLocally) {
        // we cannot call setValuesLocally yet, so we queue the message
        node.pendingCallsToSetValuesLocally.push([msg, done])
        debugInput(
          `Node ${node.id} is not ready to handle input yet, queuing message. Pending calls: ${node.pendingCallsToSetValuesLocally.length}`
        )
        return
      }

      handleInput(msg, done)
    })

    function instantiateDbus (self) {
      debug('instantiateDbus called for node', self.id, nodeInstances)
      // Connect to the dbus
      if (self.address) {
        debug(`Connecting to TCP address ${self.address}.`)
        self.bus = dbus.createClient({
          busAddress: self.address,
          authMethods: ['ANONYMOUS']
        })
      } else {
        self.bus = process.env.DBUS_SESSION_BUS_ADDRESS
          ? dbus.sessionBus()
          : dbus.systemBus()
      }
      if (!self.bus) {
        node.warn(
          'Could not connect to the DBus session bus.'
        )
        node.status({
          color: 'red',
          shape: 'dot',
          text: 'Could not connect to the DBus session bus.'
        })
        return
      }

      const actualDeviceType = config.device === 'generator'
        ? (config.generator_type === 'dc' ? 'dcgenset' : 'genset')
        : config.device

      const serviceName = `com.victronenergy.${actualDeviceType}.virtual_${self.id}`
      const interfaceName = serviceName
      const objectPath = `/${serviceName.replace(/\./g, '/')}`

      let retrying = false

      function retryConnectionDelayed () {
        if (retrying) {
          debugConnection('Already retrying DBus connection, skipping this retry.')
          return
        }
        retrying = true
        new Promise(resolve => setTimeout(resolve, 1000)).then(() => {
          debug('Retrying DBus connection...')
          instantiateDbus(self)
        }).finally(() => {
          retrying = false
        })
      }

      self.bus.connection.on('connect', () => {
        debugConnection('DBus connection established for interface', interfaceName)
        self.connected = true
      })

      self.bus.connection.on('end', () => {
        self.connected = false
        node.status({
          color: 'red',
          shape: 'dot',
          text: 'DBus connection closed'
        })
        debugConnection('DBus connection closed, retrying...')
        retryConnectionDelayed()
      })

      self.bus.connection.on('error', (err) => {
        console.error(`DBus error: ${err}`)
        debugConnection('DBus connection error:', err)
        node.status({
          color: 'red',
          shape: 'dot',
          text: 'DBus error'
        })
        retryConnectionDelayed()
      })

      if (!config.device || config.device === '') {
        node.warn(
          'No device configured'
        )
        node.status({
          color: 'red',
          shape: 'dot',
          text: 'No device configured'
        })
        return
      }

      async function callAddSettingsWithRetry (bus, settings, maxRetries = 10) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const result = await addSettings(bus, settings)
            return result
          } catch (error) {
            let errorMessage = ''
            if (Array.isArray(error)) {
              errorMessage = error.join(', ')
            } else if (error && error.message) {
              errorMessage = error.message
            } else {
              errorMessage = String(error)
            }
            const isServiceUnavailable =
              errorMessage.includes('org.freedesktop.DBus.Error.ServiceUnknown') ||
              errorMessage.includes('com.victronenergy.settings') ||
              errorMessage.includes('No such service') ||
              errorMessage.includes('was not provided by any .service files')

            if (!isServiceUnavailable || attempt === maxRetries - 1) {
              throw error
            }

            const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // Exponential backoff, max 10s
            debug(`Settings service unavailable, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      async function proceed (usedBus) {
        // First, we need to create our interface description (here we will only expose method calls)
        const ifaceDesc = {
          name: interfaceName,
          methods: {
          },
          properties: getIfaceDesc(actualDeviceType),
          signals: {
          }
        }

        // Then we need to create the interface implementation (with actual functions)
        const iface = getIface(actualDeviceType)

        iface.Status = 0
        iface.Serial = node.id || '-'

        let text = `Virtual ${config.device}`

        const deviceConfig = getDeviceConfig(config.device)
        if (deviceConfig) {
          text = deviceConfig.configure(config, iface, ifaceDesc)
        } 

        if (hasPersistedState(RED, self.id)) {
          debug(`Virtual device ${config.device} (${self.id}) has persisted state, loading it.`)
          await loadPersistedState(RED, self.id, iface, ifaceDesc)
        } else if (needsPersistedState(ifaceDesc)) {
          debug(`Virtual device ${config.device} (${self.id}) needs persisted state, but no state found. Initializing with defaults.`)
          await savePersistedState(RED, self.id, iface, ifaceDesc)
        }

        // First we use addSettings to claim a deviceInstance
        let settingsResult = null
        try {
          // First we use addSettings to claim a deviceInstance
          settingsResult = await callAddSettingsWithRetry(usedBus, [
            {
              path: `/Settings/Devices/virtual_${node.id}/ClassAndVrmInstance`,
              default: `${config.device}:100`,
              type: 's'
            }
          ])
        } catch (error) {
          console.error('Error in virtual device setup:', error)

          node.status({
            color: 'red',
            shape: 'dot',
            text: `Setup failed: ${error.message || 'Unknown error'}`
          })

          node.error('Virtual device setup failed', error)
          return
        }

        // It looks like there are a few possibilities here:
        // 1. We claimed this deviceInstance before, and we get the same one
        // 2. a. The deviceInstance is already taken, and we get a new one
        // 2. b. The deviceInstance is not taken, and we get the one we requested
        const getDeviceInstance = (result) => {
          try {
            const firstValue = result?.[0]?.[2]?.[1]?.[1]?.[0]?.split(':')[1]
            if (firstValue != null) {
              const number = Number(firstValue)
              if (!isNaN(number)) {
                return number
              }
            }
          } catch (e) {
          }

          try {
            const fallbackValue = result?.[1]?.[0]?.split(':')[1]
            if (fallbackValue != null) {
              const number = Number(fallbackValue)
              if (!isNaN(number)) {
                return number
              }
            }
          } catch (e) {
          }

          console.warn('Failed to extract valid DeviceInstance from settings result')
          return null
        }
        iface.DeviceInstance = getDeviceInstance(settingsResult)
        iface.CustomName = config.name || `Virtual ${config.device}`

        if (iface.deviceInstance === null) {
          return // Exit early if we couldn't get a valid device instance
        }

        node.iface = iface
        node.ifaceDesc = ifaceDesc

        // Now we need to actually export our interface on our object
        usedBus.exportInterface(iface, objectPath, ifaceDesc)

        usedBus.requestName(serviceName, 0x4, (err, retCode) => {
          // If there was an error, warn user and fail
          if (err) {
            node.warn(
              `Could not request service name ${serviceName}, the error was: ${err}.`
            )
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
            node.warn(
              `Failed to request service name "${serviceName} for ${config.device}". Check what return code "${retCode}" means.`
            )
            node.status({
              color: 'red',
              shape: 'dot',
              text: `Dbus errorcode ${retCode}`
            })
          }
        })

        function emitCallback (event, data) {
          if (event !== 'ItemsChanged') {
            return
          }

          const propName = data[0][0].substring(1) // Remove the leading slash

          // check if we need to persist this property
          if (ifaceDesc.properties[propName] && ifaceDesc.properties[propName].persist) {
            savePersistedState(RED, self.id, iface, ifaceDesc, propName).catch(err => {
              console.error(`Failed to persist state for ${propName}:`, err)
            })
          }
        }

        // Then we can add the required Victron interfaces, and receive some functions to use
        const {
          removeSettings,
          getValue,
          setValuesLocally
        } = addVictronInterfaces(usedBus, ifaceDesc, iface, /* add_defaults */ true, emitCallback)

        node.setValuesLocally = setValuesLocally

        // If there are pending calls, process them now
        node.pendingCallsToSetValuesLocally.forEach(([msg, done]) => {
          try {
            debugInput(`Processing pending message for node ${node.id}:`, msg)
            handleInput(msg, done)
          } catch (err) {
            node.error(`Failed to set values locally for pending message: ${err.message}`, msg)
          }
        })
        node.pendingCallsToSetValuesLocally = []

        node.removeSettings = removeSettings

        node.status({
          fill: 'green',
          shape: 'dot',
          text: `${text} (${iface.DeviceInstance})`
        })

        nodeInstances.add(node)

        if (!hasRunOnce && globalTimeoutHandle === null) {
          globalTimeoutHandle = setTimeout(async function () {
            debug('Checking for old virtual devices')
            const getValueResult = await getValue({
              path: '/Settings/Devices',
              interface: 'com.victronenergy.BusItem',
              destination: 'com.victronenergy.settings'
            })

            if (getValueResult && getValueResult[1] && Array.isArray(getValueResult[1])) {
              const deviceEntries = getValueResult[1][0]

              // Get all virtual devices first
              const virtualDevices = deviceEntries
                .filter(entry => {
                  const path = entry[0]
                  return typeof path === 'string' &&
                    path.includes('virtual_') &&
                    path.includes('ClassAndVrmInstance')
                })
                .map(entry => entry[0].split('/')[0])

              // Filter out devices that belong to active nodes
              const activeNodeIds = Array.from(nodeInstances).map(node => node.id)
              const devicesToRemove = virtualDevices.filter(devicePath => {
                return !activeNodeIds.some(nodeId => devicePath.includes(nodeId))
              })

              debug('Devices to remove (no active nodes):', devicesToRemove)

              // Remove settings for each inactive virtual device
              if (devicesToRemove.length > 0 && removeSettings) {
                // Try removing each device individually to better handle errors
                for (const device of devicesToRemove) {
                  const path = `/Settings/Devices/${device}/ClassAndVRMInstance`
                  debug('Attempting to remove:', path)

                  try {
                    const result = await removeSettings([{ path: `/Settings/Devices/${device}/ClassAndVrmInstance` }])
                    debug('Remove result for', path, ':', result)
                  } catch (err) {
                    console.error('Error removing', path, ':', err)
                  }
                }
              }
            }

            hasRunOnce = true
            globalTimeoutHandle = null
          }, 10000)
        }
      }
      proceed(self.bus)
    }

    instantiateDbus(this)

    node.on('close', function (done) {
      nodeInstances.delete(node)

      // TODO: previously, we called end() on the connection only if no nodeInstances
      // were left. Calling end() here resolves an issue with the VictronDbusListener
      // not responding to ItemsChanged signals any more after a redeploy here:
      // https://github.com/victronenergy/node-red-contrib-victron/blob/5626b44b426a3ab1c7d9a6a2d36f035f72d9faa2/src/services/dbus-listener.js#L309
      this.bus.connection.end()

      // If this was the last instance and the timeout is still pending
      if (nodeInstances.size === 0) {
        if (globalTimeoutHandle) {
          clearTimeout(globalTimeoutHandle)
          globalTimeoutHandle = null
        }
        hasRunOnce = false
      }

      done()
    })
  }

  RED.nodes.registerType('victron-virtual', VictronVirtualNode)
}
