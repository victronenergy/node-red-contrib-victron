const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const { needsPersistedState, hasPersistedState, loadPersistedState, savePersistedState } = require('./persist')
const dbus = require('dbus-native-victron')
const debug = require('debug')('victron-virtual-indicator')
const debugInput = require('debug')('victron-virtual-indicator:input')
const debugConnection = require('debug')('victron-virtual-indicator:connection')
const { DEBOUNCE_DELAY_MS } = require('./victron-virtual-constants')
const { validateVirtualDevicePayload, debounce } = require('../services/utils')
const { createIndicatorProperties, updateIndicatorStatus, INDICATOR_INPUT_KEY } = require('../services/virtual-indicator')
const { filterInactiveVirtualDevices } = require('../services/virtual-device-cleanup')

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection in victron-virtual-indicator:', reason)
})

module.exports = function (RED) {
  let hasRunOnce = false
  let globalTimeoutHandle = null
  const nodeInstances = new Set()

  function VictronVirtualIndicatorNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

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

    // Map shorthand keys (Value, Status) to full D-Bus paths
    function expandPayload (payload) {
      const expanded = {}
      for (const [key, value] of Object.entries(payload)) {
        if (key === 'Value' || key === 'Status') {
          expanded[`${INDICATOR_INPUT_KEY}/${key}`] = value
        } else {
          expanded[key] = value
        }
      }
      return expanded
    }

    function handleInput (msg, done) {
      node.send(msg)

      if (!msg || !msg.payload) {
        node.warn('Received message without payload. Expected: { Value: <number>, Status: <number> }')
        node.status({ fill: 'yellow', shape: 'ring', text: 'No payload' })
        done()
        return
      }

      const expanded = expandPayload(msg.payload)
      const validation = validateVirtualDevicePayload(expanded)
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

      try {
        debugInput(`Setting values for node ${node.id}:`, expanded)

        const immediatePayload = {}
        const debouncedPayload = {}

        for (const [key, value] of Object.entries(expanded)) {
          if (shouldApplyImmediately(key)) {
            immediatePayload[key] = value
          } else {
            debouncedPayload[key] = value
          }
        }

        if (Object.keys(immediatePayload).length > 0) {
          node.setValuesLocally(immediatePayload)
        }

        for (const [key, value] of Object.entries(debouncedPayload)) {
          getDebouncedSetter(key)(value)
        }

        node.status({
          fill: 'green',
          shape: 'dot',
          text: `Updated (${node.iface.DeviceInstance})`
        })

        if (node.statusRevertTimeout) clearTimeout(node.statusRevertTimeout)
        node.statusRevertTimeout = setTimeout(() => {
          updateIndicatorStatus(config, node)
          node.statusRevertTimeout = null
        }, 5000)

        done()
      } catch (err) {
        node.error(`Failed to set values: ${err.message}`, msg)
        node.status({ fill: 'red', shape: 'dot', text: `Failed: ${err.message}` })
        done(err)
      }
    }

    this.on('input', function (msg, _send, done) {
      if (!node.setValuesLocally) {
        node.pendingCallsToSetValuesLocally.push([msg, done])
        debugInput(`Node ${node.id} not ready, queuing message`)
        return
      }
      handleInput(msg, done)
    })

    function instantiateDbus (self) {
      if (self.address) {
        self.bus = dbus.createClient({ busAddress: self.address, authMethods: ['ANONYMOUS'] })
      } else {
        self.bus = process.env.DBUS_SESSION_BUS_ADDRESS ? dbus.sessionBus() : dbus.systemBus()
      }

      if (!self.bus) {
        node.warn('Could not connect to the DBus session bus.')
        node.status({ color: 'red', shape: 'dot', text: 'Could not connect to the DBus session bus.' })
        return
      }

      const serviceName = `com.victronenergy.switch.virtual_${self.id}`
      const interfaceName = serviceName
      const objectPath = `/${serviceName.replace(/\./g, '/')}`

      let retrying = false

      function retryConnectionDelayed () {
        if (retrying) return
        retrying = true
        new Promise(resolve => setTimeout(resolve, 1000)).then(() => {
          instantiateDbus(self)
        }).finally(() => {
          retrying = false
        })
      }

      self.bus.connection.on('connect', () => {
        debugConnection('DBus connection established for', interfaceName)
        self.connected = true
      })

      self.bus.connection.on('end', () => {
        self.connected = false
        node.status({ color: 'red', shape: 'dot', text: 'DBus connection closed' })
        if (self.retryOnConnectionEnd) {
          retryConnectionDelayed()
        }
      })

      self.bus.connection.on('error', (err) => {
        console.error(`DBus error: ${err}`)
        node.status({ color: 'red', shape: 'dot', text: 'DBus error' })
        retryConnectionDelayed()
      })

      async function callAddSettingsWithRetry (bus, settings, maxRetries = 10) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await addSettings(bus, settings)
          } catch (error) {
            const errorMessage = Array.isArray(error) ? error.join(', ') : (error?.message || String(error))
            const isServiceUnavailable =
              errorMessage.includes('org.freedesktop.DBus.Error.ServiceUnknown') ||
              errorMessage.includes('com.victronenergy.settings') ||
              errorMessage.includes('No such service') ||
              errorMessage.includes('was not provided by any .service files')

            if (!isServiceUnavailable || attempt === maxRetries - 1) throw error

            const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
            debug(`Settings service unavailable, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      async function proceed (usedBus) {
        const ifaceDesc = { name: interfaceName, methods: {}, properties: {}, signals: {} }
        const iface = { Status: 0, Serial: node.id || '-' }

        createIndicatorProperties(config, ifaceDesc, iface)

        if (hasPersistedState(RED, self.id)) {
          await loadPersistedState(RED, self.id, iface, ifaceDesc)
        } else if (needsPersistedState(ifaceDesc)) {
          await savePersistedState(RED, self.id, iface, ifaceDesc)
        }

        let settingsResult = null
        try {
          settingsResult = await callAddSettingsWithRetry(usedBus, [{
            path: `/Settings/Devices/virtual_${node.id}/ClassAndVrmInstance`,
            default: 'switch:100',
            type: 's'
          }])
        } catch (error) {
          console.error('Error in virtual indicator setup:', error)
          node.status({ color: 'red', shape: 'dot', text: `Setup failed: ${error.message || 'Unknown error'}` })
          node.error('Virtual indicator setup failed', error)
          return
        }

        const getDeviceInstance = (result) => {
          try {
            const firstValue = result?.[0]?.[2]?.[1]?.[1]?.[0]?.split(':')[1]
            if (firstValue != null) {
              const number = Number(firstValue)
              if (!isNaN(number)) return number
            }
          } catch (e) {}

          try {
            const fallbackValue = result?.[1]?.[0]?.split(':')[1]
            if (fallbackValue != null) {
              const number = Number(fallbackValue)
              if (!isNaN(number)) return number
            }
          } catch (e) {}

          console.warn('Failed to extract valid DeviceInstance from settings result')
          return null
        }

        iface.DeviceInstance = getDeviceInstance(settingsResult)
        iface.CustomName = config.name || config.customname || 'Virtual Indicator'

        if (iface.DeviceInstance === null) return

        node.iface = iface
        node.ifaceDesc = ifaceDesc

        usedBus.exportInterface(iface, objectPath, ifaceDesc)

        usedBus.requestName(serviceName, 0x4, (err, retCode) => {
          if (err) {
            node.warn(`Could not request service name ${serviceName}: ${err}`)
            node.status({ color: 'red', shape: 'dot', text: `${err}` })
            return
          }

          if (retCode === 1 || retCode === 3) {
            if (retCode === 3) {
              node.warn(`Service name "${serviceName}" already exists on the bus.`)
            }
            node.serviceName = serviceName
          } else {
            node.warn(`Failed to request service name "${serviceName}". Return code: ${retCode}`)
            node.status({ color: 'red', shape: 'dot', text: `Dbus errorcode ${retCode}` })
          }
        })

        function emitCallback (event, data) {
          if (event !== 'ItemsChanged') return

          const propName = data[0][0].substring(1)

          if (ifaceDesc.properties[propName] && ifaceDesc.properties[propName].persist) {
            savePersistedState(RED, self.id, iface, ifaceDesc, propName).catch(err => {
              console.error(`Failed to persist state for ${propName}:`, err)
            })
          }

          if (!node.statusRevertTimeout) {
            updateIndicatorStatus(config, node)
          }
        }

        const { removeSettings, getValue, setValuesLocally } = addVictronInterfaces(
          usedBus, ifaceDesc, iface, true, emitCallback
        )

        node.setValuesLocally = setValuesLocally

        node.pendingCallsToSetValuesLocally.forEach(([msg, done]) => {
          try {
            handleInput(msg, done)
          } catch (err) {
            node.error(`Failed to handle pending message: ${err.message}`, msg)
          }
        })
        node.pendingCallsToSetValuesLocally = []

        node.removeSettings = removeSettings

        updateIndicatorStatus(config, node)

        nodeInstances.add(node)

        if (!hasRunOnce && globalTimeoutHandle === null) {
          globalTimeoutHandle = setTimeout(async function () {
            const getValueResult = await getValue({
              path: '/Settings/Devices',
              interface: 'com.victronenergy.BusItem',
              destination: 'com.victronenergy.settings'
            })

            if (getValueResult && getValueResult[1] && Array.isArray(getValueResult[1])) {
              const deviceEntries = getValueResult[1][0]
              const activeServices = await new Promise((resolve) => {
                usedBus.listNames((error, services) => resolve(error ? [] : (services || [])))
              })

              const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)
              if (devicesToRemove.length > 0 && removeSettings) {
                for (const device of devicesToRemove) {
                  try {
                    await removeSettings([{ path: `/Settings/Devices/${device}/ClassAndVrmInstance` }])
                  } catch (err) {
                    console.error('Error removing', device, ':', err)
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

      if (node.serviceName && this.bus && this.bus.invoke) {
        this.bus.releaseName(node.serviceName, (err, result) => {
          if (err) console.error(`Error releasing service name ${node.serviceName}:`, err)
          else debug(`Released service name ${node.serviceName}, code: ${result}`)
          finishClose()
        })
      } else {
        finishClose()
      }

      function finishClose () {
        node.retryOnConnectionEnd = false
        node.bus.connection.end()

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

  RED.nodes.registerType('victron-virtual-indicator', VictronVirtualIndicatorNode)
}
