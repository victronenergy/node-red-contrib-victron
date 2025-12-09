/**
 * Virtual Switch Node - Dedicated node for creating virtual switches
 *
 * This node is a specialized version of the Virtual Device node,
 * focused solely on switch functionality. It uses shared logic from
 * /src/services/virtual-switch.js to ensure identical behavior with
 * the legacy Virtual Device (switch) configuration.
 */

const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const { needsPersistedState, hasPersistedState, loadPersistedState, savePersistedState } = require('./persist')
const dbus = require('dbus-native-victron')
const debug = require('debug')('victron-virtual-switch')
const debugInput = require('debug')('victron-virtual-switch:input')
const debugConnection = require('debug')('victron-virtual-switch:connection')
const { DEBOUNCE_DELAY_MS } = require('./victron-virtual-constants')
const { validateVirtualDevicePayload, validateLightControls, debounce } = require('../services/utils')
const { createSwitchProperties, getSwitchStatusText, handleSwitchOutputs } = require('../services/virtual-switch')

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION (PREVENTING CRASH) ===')
  console.error('Promise:', promise)
  console.error('Reason:', reason)
  console.error('Reason type:', typeof reason)
  console.error('Is array:', Array.isArray(reason))
  console.error('Array contents:', JSON.stringify(reason, null, 2))
  console.error('Stack trace:')
  console.trace()
  console.error('=== END DEBUG ===')
})

module.exports = function (RED) {
  // Shared state across all instances
  let hasRunOnce = false
  let globalTimeoutHandle = null
  const nodeInstances = new Set()

  function VictronVirtualSwitchNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

    node.lastSentValues = {}

    const address = process.env.NODE_RED_DBUS_ADDRESS
      ? process.env.NODE_RED_DBUS_ADDRESS.split(':')
      : null
    if (address && address.length === 2) {
      this.address = `tcp:host=${address[0]},port=${address[1]}`
    }

    node.retryOnConnectionEnd = true
    node.pendingCallsToSetValuesLocally = []

    const debouncedSetters = new Map()

    function shouldApplyImmediately (key) {
      if (node.ifaceDesc && node.ifaceDesc.properties && node.ifaceDesc.properties[key]) {
        return node.ifaceDesc.properties[key].immediate === true
      }
      return false
    }

    function getDebouncedSetter (key) {
      if (!debouncedSetters.has(key)) {
        const setter = debounce((value) => {
          debugInput(`Applying debounced value for ${key}: ${value}`)
          try {
            node.setValuesLocally({ [key]: value })
          } catch (err) {
            node.error(`Failed to apply debounced value for ${key}: ${err.message}`)
          }
        }, DEBOUNCE_DELAY_MS)
        debouncedSetters.set(key, setter)
      }
      return debouncedSetters.get(key)
    }

    function handleInput (msg, done) {
      // Send passthrough message FIRST, before any validation
      const outputs = [msg]
      for (let i = 1; i < config.outputs; i++) {
        outputs.push(null)
      }
      node.send(outputs)

      if (!msg || !msg.payload) {
        node.warn('Received message without payload. Expected: JavaScript object with at least one property/value.')
        node.status({
          fill: 'yellow',
          shape: 'ring',
          text: 'No payload - expected JSON object'
        })
        done()
        return
      }

      const validation = validateVirtualDevicePayload(msg.payload)
      if (!validation.valid) {
        node.warn(validation.error)
        node.status({
          fill: 'yellow',
          shape: 'ring',
          text: validation.invalidKeys
            ? `Invalid value types for: ${validation.invalidKeys.join(', ')}`
            : 'Invalid payload'
        })
        done()
        return
      }

      if (msg.payload['SwitchableOutput/output_1/LightControls']) {
        const lightControlsValidation = validateLightControls(msg.payload['SwitchableOutput/output_1/LightControls'])
        if (!lightControlsValidation.valid) {
          node.warn(lightControlsValidation.error)
          node.status({
            fill: 'yellow',
            shape: 'ring',
            text: 'Invalid LightControls values'
          })
          done()
          return
        }
      }

      try {
        debugInput(`Setting values locally for node ${node.id}:`, msg.payload)

        const immediatePayload = {}
        const debouncedPayload = {}

        for (const [key, value] of Object.entries(msg.payload)) {
          if (shouldApplyImmediately(key)) {
            immediatePayload[key] = value
          } else {
            debouncedPayload[key] = value
          }
        }

        if (Object.keys(immediatePayload).length > 0) {
          node.setValuesLocally(immediatePayload)
          debugInput(`Applied ${Object.keys(immediatePayload).length} immediate properties`)
        }

        for (const [key, value] of Object.entries(debouncedPayload)) {
          const setter = getDebouncedSetter(key)
          setter(value)
          debugInput(`Debouncing ${key} for ${DEBOUNCE_DELAY_MS}ms`)
        }

        const pathCount = Object.keys(msg.payload).length
        const pathWord = pathCount === 1 ? 'path' : 'paths'

        node.status({
          fill: 'green',
          shape: 'dot',
          text: `Updated ${pathCount} ${pathWord} (${node.iface.DeviceInstance})`
        })
        done()
      } catch (err) {
        node.error(`Failed to set values: ${err.message}. Expected: JavaScript object with at least one property/value.`, msg)
        node.status({
          fill: 'red',
          shape: 'dot',
          text: `Failed: ${err.message}`
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

      const serviceName = `com.victronenergy.switch.virtual_${self.id}`
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
        if (self.retryOnConnectionEnd) {
          retryConnectionDelayed()
        } else {
          debug('Not retrying DBus connection, as retryOnConnectionEnd is false.', interfaceName)
        }
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
        const ifaceDesc = {
          name: interfaceName,
          methods: {},
          properties: {},
          signals: {}
        }

        const iface = {
          Status: 0,
          Serial: node.id || '-'
        }

        createSwitchProperties(config, ifaceDesc, iface)

        const text = getSwitchStatusText(config)

        if (hasPersistedState(RED, self.id)) {
          debug(`Virtual switch (${self.id}) has persisted state, loading it.`)
          await loadPersistedState(RED, self.id, iface, ifaceDesc)
        } else if (needsPersistedState(ifaceDesc)) {
          debug(`Virtual switch (${self.id}) needs persisted state, but no state found. Initializing with defaults.`)
          await savePersistedState(RED, self.id, iface, ifaceDesc)
        }

        let settingsResult = null
        try {
          settingsResult = await callAddSettingsWithRetry(usedBus, [
            {
              path: `/Settings/Devices/virtual_${node.id}/ClassAndVrmInstance`,
              default: 'switch:100',
              type: 's'
            }
          ])
        } catch (error) {
          console.error('Error in virtual switch setup:', error)

          node.status({
            color: 'red',
            shape: 'dot',
            text: `Setup failed: ${error.message || 'Unknown error'}`
          })

          node.error('Virtual switch setup failed', error)
          return
        }

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
        iface.CustomName = config.name || 'Virtual switch'

        if (iface.DeviceInstance === null) {
          return // Exit early if we couldn't get a valid device instance
        }

        node.iface = iface
        node.ifaceDesc = ifaceDesc

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
            // Store serviceName on node for cleanup during close
            if (retCode === 3) {
              console.warn(`Service name "${serviceName}" already exists on the bus, this may result in undesired behavior.`)
              node.warn(`Service name "${serviceName}" already exists on the bus, this may result in undesired behavior.`)
            }
            node.serviceName = serviceName
          } else {
            /* Other return codes means various errors, check here
            (https://dbus.freedesktop.org/doc/api/html/group__DBusShared.html#ga37a9bc7c6eb11d212bf8d5e5ff3b50f9) for more
            information */
            node.warn(
              `Failed to request service name "${serviceName}". Check what return code "${retCode}" means.`
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
          const propValue = data[0][1][0][1][1]

          // check if we need to persist this property
          if (ifaceDesc.properties[propName] && ifaceDesc.properties[propName].persist) {
            savePersistedState(RED, self.id, iface, ifaceDesc, propName).catch(err => {
              console.error(`Failed to persist state for ${propName}:`, err)
            })
          }

          handleSwitchOutputs(config, node, propName, propValue)
        }

        const {
          removeSettings,
          getValue,
          setValuesLocally,
          emitS2Signal
        } = addVictronInterfaces(usedBus, ifaceDesc, iface, /* add_defaults */ true, emitCallback)

        node.setValuesLocally = setValuesLocally
        node.emitS2Signal = emitS2Signal

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

      // Release the DBus service name before closing connection
      // This prevents the service from remaining registered after node deletion
      if (node.serviceName && this.bus && this.bus.invoke) {
        debug(`Releasing DBus service name: ${node.serviceName}`)
        this.bus.releaseName(node.serviceName, (err, result) => {
          if (err) {
            console.error(`Error releasing service name ${node.serviceName}:`, err)
          } else {
            // 1 = DBUS_RELEASE_NAME_REPLY_RELEASED (success)
            // 2 = DBUS_RELEASE_NAME_REPLY_NON_EXISTENT (already released)
            // 3 = DBUS_RELEASE_NAME_REPLY_NOT_OWNER (not owner)
            debug(`Released service name ${node.serviceName}, code: ${result}`)
          }

          // Continue with connection cleanup after release attempt
          finishClose()
        })
      } else {
        // No service name to release, proceed directly
        finishClose()
      }

      function finishClose () {
        node.retryOnConnectionEnd = false
        node.bus.connection.end()

        // If this was the last instance and the timeout is still pending
        if (nodeInstances.size === 0) {
          if (globalTimeoutHandle) {
            clearTimeout(globalTimeoutHandle)
            globalTimeoutHandle = null
          }
          hasRunOnce = false
        }

        done()
      }
    })
  }

  RED.nodes.registerType('victron-virtual-switch', VictronVirtualSwitchNode)
}
