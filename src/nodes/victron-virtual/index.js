const fs = require('fs')
const path = require('path')
const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const { needsPersistedState, hasPersistedState, loadPersistedState, savePersistedState } = require('../persist')
const dbus = require('dbus-native-victron')
const debug = require('debug')('victron-virtual')
const debugInput = require('debug')('victron-virtual:input')
const debugConnection = require('debug')('victron-virtual:connection')
const {
  DEBOUNCE_DELAY_MS
} = require('../victron-virtual-constants')
const { validateVirtualDevicePayload, validateLightControls, debounce } = require('../../services/utils')
const { handleSwitchOutputs } = require('../../services/virtual-switch')
const { filterInactiveVirtualDevices } = require('../../services/virtual-device-cleanup')
const { makeSetPresence } = require('./helpers')

const acloadModule = require('./device-type/acload')
const batteryModule = require('./device-type/battery')
const evModule = require('./device-type/ev')
const generatorModule = require('./device-type/generator')
const gpsModule = require('./device-type/gps')
const gridModule = require('./device-type/grid')
const meteoModule = require('./device-type/meteo')
const motordriveModule = require('./device-type/motordrive')
const pvinverterModule = require('./device-type/pvinverter')
const switchModule = require('./device-type/switch')
const tankModule = require('./device-type/tank')
const temperatureModule = require('./device-type/temperature')

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

const properties = {
  acload: acloadModule.properties,
  battery: batteryModule.properties,
  ev: evModule.properties,
  temperature: temperatureModule.properties,
  genset: generatorModule.properties.genset,
  dcgenset: generatorModule.properties.dcgenset,
  grid: gridModule.properties,
  pvinverter: pvinverterModule.properties,
  meteo: meteoModule.properties,
  motordrive: motordriveModule.properties,
  switch: switchModule.properties,
  tank: tankModule.properties,
  gps: gpsModule.properties
}

// Keyed by config.device value
const deviceModules = {
  acload: acloadModule,
  battery: batteryModule,
  ev: evModule,
  generator: generatorModule,
  gps: gpsModule,
  grid: gridModule,
  meteo: meteoModule,
  motordrive: motordriveModule,
  'e-drive': motordriveModule,
  pvinverter: pvinverterModule,
  switch: switchModule,
  tank: tankModule,
  temperature: temperatureModule
}

const DEVICE_TYPES = [
  { value: 'acload', label: 'AC Load' },
  { value: 'battery', label: 'Battery' },
  { value: 'e-drive', label: 'E-drive' },
  { value: 'ev', label: 'Electric Vehicle' },
  { value: 'generator', label: 'Generator' },
  { value: 'gps', label: 'GPS' },
  { value: 'grid', label: 'Grid meter' },
  { value: 'meteo', label: 'Meteo' },
  { value: 'pvinverter', label: 'PV inverter' },
  { value: 'tank', label: 'Tank sensor' },
  { value: 'temperature', label: 'Temperature sensor' }
]

const registeredModules = new Set(Object.keys(deviceModules))
try {
  fs.readdirSync(path.join(__dirname, 'device-type'))
    .filter(f => f.endsWith('.js'))
    .map(f => path.basename(f, '.js'))
    .filter(name => !registeredModules.has(name))
    .forEach(name => {
      try {
        const mod = require(path.join(__dirname, 'device-type', name))
        deviceModules[name] = mod
        properties[name] = mod.properties
        const label = mod.label || (name.charAt(0).toUpperCase() + name.slice(1))
        DEVICE_TYPES.push({ value: name, label })
        debug(`Loaded virtual device type: ${name} (${label})`)
      } catch (err) {
        console.error(`Failed to load virtual device type "${name}":`, err)
      }
    })
} catch (err) {
  console.error('Failed to load virtual device types:', err)
}

function getActualDeviceType (type, subtype) {
  if (type === 'generator') return subtype === 'dc' ? 'dcgenset' : 'genset'
  if (type === 'e-drive') return 'motordrive'
  return type
}

function getIfaceDesc (actualDev, config) {
  if (!properties[actualDev]) {
    return {}
  }

  const result = {}

  let deviceProperties = properties[actualDev]
  if (typeof properties[actualDev] === 'function') {
    deviceProperties = properties[actualDev](config)
  }

  // Deep copy the properties, including format functions
  for (const [key, value] of Object.entries(deviceProperties)) {
    result[key] = { ...value }
    if (typeof value.format === 'function') {
      result[key].format = value.format
    }
  }

  result.DeviceInstance = { type: 'i' }
  result.CustomName = { type: 's', persist: true }
  result.Serial = { type: 's', persist: true }

  return result
}

function getIface (actualDev, config) {
  if (!properties[actualDev]) {
    return {
      emit: function () {
      }
    }
  }

  const result = {
    emit: function () {
    }
  }

  const ifaceProperties = typeof properties[actualDev] === 'function' ? properties[actualDev](config) : properties[actualDev]

  for (const key in ifaceProperties) {
    const propertyValue = JSON.parse(JSON.stringify(ifaceProperties[key]))

    if (propertyValue.value !== undefined) {
      result[key] = propertyValue.value
    } else {
      switch (propertyValue.type) {
        case 's':
          result[key] = '-'
          break
        default:
          result[key] = null
      }
    }
  }

  return result
}

module.exports = function (RED) {
  RED.httpNode.get('/victron/virtual-device-types', (_req, res) => {
    res.json(DEVICE_TYPES)
  })

  // Shared state across all instances
  let hasRunOnce = false
  let globalTimeoutHandle = null
  const nodeInstances = new Set()

  function VictronVirtualNode (config) {
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
    node.presenceConnected = false
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
      // S2 signal messages are internal control - never pass through to any output
      if (msg.payload && msg.payload.s2Signal !== undefined) {
        // Fall through to s2Signal handler below
      } else {
        // Send passthrough message FIRST, before any validation
        const userSetConnected = msg.connected !== undefined
        if (!userSetConnected) {
          msg.connected = node.presenceConnected
        }
        const outputs = [msg]
        // Fill remaining outputs with null
        for (let i = 1; i < config.outputs; i++) {
          outputs.push(null)
        }
        node.send(outputs)

        if (userSetConnected) {
          node.setPresence(!!msg.connected, done)
          return
        }
      }

      // Now do validation with more helpful messages
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

      function failAndDone (text, done) {
        node.status({
          fill: 'red',
          shape: 'dot',
          text
        })
        return done()
      }

      function successAndDone (text, done) {
        node.status({
          fill: 'green',
          shape: 'dot',
          text
        })
        return done()
      }

      if (msg.payload.s2Signal !== undefined) {
        switch (msg.payload.s2Signal) {
          case 'Message':
            if (!msg.payload.message) {
              return failAndDone('s2Signal "Message" requires message', done)
            }
            node.emitS2Signal(msg.payload.s2Signal, [JSON.stringify(msg.payload.message)])
            return successAndDone('Sent s2Signal "Message"', done)
          case 'Disconnect':
            if (!msg.payload.reason) {
              return failAndDone('s2Signal "Disconnect" requires reason', done)
            }
            node.emitS2Signal(msg.payload.s2Signal, [msg.payload.reason])
            return successAndDone('Sent s2Signal "Disconnect"', done)
          case 'PowerMeasurementStart': {
            node._s2PowerMeasurementActive = true
            node._s2PowerMeasurementCemId = msg.cemId
            // Emit current values immediately so the CEM doesn't wait for the first change
            const measurementProps = node.ifaceDesc && node.ifaceDesc.__s2PowerMeasurementProps
            if (measurementProps && node.iface) {
              for (const [propName, commodityQuantity] of Object.entries(measurementProps)) {
                const propValue = node.iface[propName]
                if (propValue !== null && propValue !== undefined) {
                  node.send([null, {
                    payload: {
                      command: 'PowerMeasurement',
                      cemId: node._s2PowerMeasurementCemId,
                      values: [{ commodity_quantity: commodityQuantity, value: propValue }]
                    }
                  }])
                }
              }
            }
            return successAndDone('Power measurement started', done)
          }
          case 'PowerMeasurementStop':
            node._s2PowerMeasurementActive = false
            node._s2PowerMeasurementCemId = null
            return successAndDone('Power measurement stopped', done)
          default:
            return failAndDone(`s2Signal "${msg.payload.s2Signal}" not implemented`, done)
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
          text: `Updated ${pathCount} ${pathWord} for ${config.device} (${node.iface.DeviceInstance})`
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

      const actualDeviceType = getActualDeviceType(config.device, config.generator_type)
      const dbusServiceType = deviceModules[config.device]?.getServiceType?.(config) ?? actualDeviceType

      const serviceName = `com.victronenergy.${dbusServiceType}.virtual_${self.id}`
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
          properties: getIfaceDesc(actualDeviceType, config),
          signals: {
          }
        }

        if (dbusServiceType !== config.device) {
          ifaceDesc.productType = config.device
        }

        // Then we need to create the interface implementation (with actual functions)
        const iface = getIface(actualDeviceType, config)

        iface.Status = 0
        iface.Serial = node.id || '-'

        let text = `Virtual ${config.device}`

        // Device-specific configuration
        const deviceModule = deviceModules[config.device]
        if (deviceModule) {
          const result = deviceModule.initialize(config, ifaceDesc, iface, node)
          if (result != null) {
            text = result
          }
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
              default: `${dbusServiceType}:100`,
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

        // Migrate legacy ClassAndVrmInstance values ('generator', 'e-drive') to the correct
        // D-Bus type. AddSettings only sets defaults so existing values are never overwritten
        // automatically — we need an explicit SetValue to fix them.
        const currentClassAndVrmInstance = settingsResult?.[0]?.[2]?.[1]?.[1]?.[0] || settingsResult?.[1]?.[0]
        if (currentClassAndVrmInstance) {
          const parts = currentClassAndVrmInstance.split(':')
          const currentClass = parts[0]
          const vrmInstance = parts[1]
          if (currentClass !== dbusServiceType && !vrmInstance) {
            throw new Error(`Invalid ClassAndVrmInstance value: ${currentClassAndVrmInstance}`)
          }
          if (currentClass !== dbusServiceType) {
            const newValue = `${dbusServiceType}:${vrmInstance}`
            const migrationSucceeded = await new Promise(resolve => {
              usedBus.invoke({
                path: `/Settings/Devices/virtual_${node.id}/ClassAndVrmInstance`,
                destination: 'com.victronenergy.settings',
                interface: 'com.victronenergy.BusItem',
                member: 'SetValue',
                body: [['s', newValue]],
                signature: 'v'
              }, (err) => {
                if (err) {
                  debug(`Failed to migrate ClassAndVrmInstance: ${err}`)
                  resolve(false)
                } else {
                  debug(`Migrated ClassAndVrmInstance from ${currentClassAndVrmInstance} to ${newValue}`)
                  resolve(true)
                }
              })
            })
            if (migrationSucceeded) {
              // Re-read the actual assigned value — localsettings may have reassigned
              // the VRM instance if the target class already had a conflict.
              try {
                const updatedResult = await callAddSettingsWithRetry(usedBus, [{
                  path: `/Settings/Devices/virtual_${node.id}/ClassAndVrmInstance`,
                  default: `${actualDeviceType}:${vrmInstance}`,
                  type: 's'
                }])
                iface.DeviceInstance = getDeviceInstance(updatedResult)
                debug(`DeviceInstance after migration: ${iface.DeviceInstance}`)
              } catch (err) {
                debug(`Failed to read back ClassAndVrmInstance after migration: ${err}`)
              }
            }
          }
        }

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
            // Store serviceName on node for cleanup during close
            if (retCode === 3) {
              console.warn(`Service name "${serviceName}" for ${config.device} already exists on the bus, this may result in undesired behavior.`)
              node.warn(`Service name "${serviceName}" for ${config.device} already exists on the bus, this may result in undesired behavior.`)
            }
            node.serviceName = serviceName
            if (config.start_disconnected) {
              node.bus.releaseName(node.serviceName, () => {
                node.presenceConnected = false
                node.status({ fill: 'grey', shape: 'ring', text: `${text} (${iface.DeviceInstance}) — offline` })
              })
            }
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

        // TODO: S2: Should we rename this?
        // We need to add a emitCallbackS2 for S2-related property changes
        // to be able to react to imocoming connection requests and messages.
        function emitCallback (event, data) {
          // we could use node.context().set('bla', 42) to set (and get) state, but state disappears on redeploy
          // for global context: node.context().global.set('bla', 43)
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

          // Legacy support: Handle outputs for existing Virtual Device (switch) nodes
          if (config.device === 'switch') {
            handleSwitchOutputs(config, node, propName, propValue)
          }

          // S2 power measurement: emit when the changed property is a declared power measurement property
          if (node._s2PowerMeasurementActive &&
              ifaceDesc.__s2PowerMeasurementProps &&
              ifaceDesc.__s2PowerMeasurementProps[propName] !== undefined &&
              propValue !== null && propValue !== undefined) {
            node.send([null, {
              payload: {
                command: 'PowerMeasurement',
                cemId: node._s2PowerMeasurementCemId,
                values: [{ commodity_quantity: ifaceDesc.__s2PowerMeasurementProps[propName], value: propValue }]
              }
            }])
          }
        }

        // Then we can add the required Victron interfaces, and receive some functions to use
        const {
          removeSettings,
          getValue,
          setValuesLocally,
          emitS2Signal
        } = addVictronInterfaces(usedBus, ifaceDesc, iface, /* add_defaults */ true, emitCallback)

        node.setValuesLocally = setValuesLocally
        node.emitS2Signal = emitS2Signal

        node.setPresence = makeSetPresence(node, text, iface)

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

        node.presenceConnected = true
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

              // Get all active DBus services to check which virtual devices are actually active
              const activeServices = await new Promise((resolve, reject) => {
                usedBus.listNames((error, services) => {
                  if (error) {
                    console.error('Error listing DBus services:', error)
                    resolve([])
                  } else {
                    resolve(services || [])
                  }
                })
              })

              debug('Active DBus services:', activeServices)

              // Only remove devices that are not active on DBus
              const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

              debug('Virtual devices to remove (no active nodes):', devicesToRemove)

              // Remove settings for each inactive virtual device
              if (devicesToRemove.length > 0 && removeSettings) {
                // Try removing each device individually to better handle errors
                for (const device of devicesToRemove) {
                  const path = `/Settings/Devices/${device}/ClassAndVrmInstance`
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
        // TODO: previously, we called end() on the connection only if no nodeInstances
        // were left. Calling end() here resolves an issue with the VictronDbusListener
        // not responding to ItemsChanged signals any more after a redeploy here:
        // https://github.com/victronenergy/node-red-contrib-victron/blob/5626b44b426a3ab1c7d9a6a2d36f035f72d9faa2/src/services/dbus-listener.js#L309
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

  RED.nodes.registerType('victron-virtual', VictronVirtualNode)
}
