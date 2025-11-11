const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const { needsPersistedState, hasPersistedState, loadPersistedState, savePersistedState } = require('./persist')
const dbus = require('dbus-native-victron')
const debug = require('debug')('victron-virtual')
const debugInput = require('debug')('victron-virtual:input')
const debugConnection = require('debug')('victron-virtual:connection')
const {
  SWITCH_TYPE_MAP,
  SWITCH_TYPE_NAMES,
  SWITCH_TYPE_BITMASK_NAMES,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL,
  DEBOUNCE_DELAY_MS
} = require('./victron-virtual-constants')
const { hsbToRgb } = require('../services/color-utils')
const { validateVirtualDevicePayload, validateLightControls, debounce } = require('../services/utils')

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

const commonGeneratorProperties = {
  AutoStart: { type: 'i', format: (v) => v != null ? v : '', value: 1, persist: true },
  Start: { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: true, immediate: true },
  RemoteStartModeEnabled: { type: 'i', format: (v) => v != null ? v : '', value: 1, persist: true },
  EnableRemoteStartMode: { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: true, immediate: true },
  'Engine/CoolantTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Engine/ExhaustTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Engine/OilTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Engine/OilPressure': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'bar' : '', immediate: true },
  'Engine/WindingTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Engine/Starts': { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: 60, immediate: true },
  'Engine/Load': { type: 'd', format: (v) => v != null ? v.toFixed(1) + '%' : '', immediate: true },
  'Engine/Speed': { type: 'i', format: (v) => v != null ? v + 'RPM' : '', immediate: true },
  'Engine/OperatingHours': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'h' : '', persist: 300, immediate: true },
  'Alarms/HighTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowOilPressure': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowCoolantLevel': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowOilLevel': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowFuelLevel': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowStarterVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/HighStarterVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/EmergencyStop': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/ServicesNeeded': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/GenericAlarm': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  StatusCode: {
    type: 'i',
    format: (v) => ({
      0: 'Standby',
      1: 'Startup 1',
      2: 'Startup 2',
      3: 'Startup 3',
      4: 'Startup 4',
      5: 'Startup 5',
      6: 'Startup 6',
      7: 'Startup 7',
      8: 'Running',
      9: 'Cooldown',
      10: 'Stopping',
      11: 'Error'
    }[v] || 'unknown'),
    value: 0,
    immediate: true
  },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  StarterVoltage: { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: true, immediate: true },
  FirmwareVersion: { type: 's', format: (v) => v != null ? v : '', persist: true },
  Model: { type: 's', format: (v) => v != null ? v : '', persist: true },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1, immediate: true }
}

const properties = {
  battery: {
    Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'Ah' : '', persist: true },
    'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', immediate: true },
    'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', immediate: true },
    'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', immediate: true },
    'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
    'Info/BatteryLowVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Info/MaxChargeVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Info/MaxChargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Info/MaxDischargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Info/ChargeRequest': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    Soc: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: 15 /* persist, but throttled to 15 seconds */, immediate: true },
    Soh: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: 60 /* persist, but throttled to 60 seconds */, immediate: true },
    TimeToGo: { type: 'd', max: 864000, format: (v) => v != null ? v.toFixed(0) + 's' : '', immediate: true },
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1, immediate: true },
    'Alarms/CellImbalance': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/HighCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/HighChargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/HighCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/HighDischargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/HighTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/HighVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/InternalFailure': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/LowCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/LowSoc': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/LowTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/LowVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    'Alarms/StateOfHealth': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
    NrOfDistributors: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'System/MinCellVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'V' : '', immediate: true }
  },
  temperature: {
    Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 60 /* persist, but throttled to 60 seconds */, immediate: true },
    TemperatureType: {
      type: 'i',
      value: 2,
      min: 0,
      max: 2,
      format: (v) => ({
        0: 'Battery',
        1: 'Fridge',
        2: 'Generic',
        3: 'Room',
        4: 'Outdoor',
        5: 'WaterHeater',
        6: 'Freezer'
      }[v] || 'unknown')
    },
    Pressure: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'hPa' : '', persist: 60 },
    Humidity: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '%' : '', persist: 60 },
    BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: 300 },
    Status: { type: 'i', persist: true /* persist on every state change */ }
  },
  genset: {
    ...commonGeneratorProperties,
    'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'Hz' : '' },
    NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
  },
  dcgenset: {
    ...commonGeneratorProperties,
    'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'History/EnergyOut': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    State: {
      type: 'i',
      format: (v) => ({
        0: 'Stopped',
        1: 'Running'
      }[v] || 'unknown'),
      value: 0
    }
  },
  grid: {
    'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
    'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
    'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'Hz' : '' },
    'Ac/N/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
    ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
  },
  pvinverter: {
    'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/MaxPower': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/PowerLimit': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    ErrorCode: {
      type: 'i',
      value: 0,
      format: (v) => ({
        0: 'No error'
      }[v] || 'unknown')
    },
    Position: {
      type: 'i',
      format: (v) => ({
        0: 'AC input 1',
        1: 'AC output',
        2: 'AC input 2'
      }[v] || 'unknown')
    },
    StatusCode: {
      type: 'i',
      format: (v) => ({
        0: 'Startup 0',
        1: 'Startup 1',
        2: 'Startup 2',
        3: 'Startup 3',
        4: 'Startup 4',
        5: 'Startup 5',
        6: 'Startup 6',
        7: 'Running',
        8: 'Standby',
        9: 'Boot loading',
        10: 'Error'
      }[v] || 'unknown')
    },
    NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
  },
  meteo: {
    CellTemperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 300 },
    ExternalTemperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 300 },
    Irradiance: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'W/m2' : '', persist: 300 },
    WindSpeed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '', persist: 300 },
    WindDirection: { type: 'i', persist: 300 }
  },
  motordrive: {
    'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Controller/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    'Coolant/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    'Motor/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    'Motor/RPM': { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'RPM' : '' },
    'Motor/Direction': {
      type: 'i',
      format: (v) => ({
        0: 'Neutral',
        1: 'Reverse',
        2: 'Forward'
      }[v] || 'unknown'),
      value: 0,
      persist: true
    },
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
  },
  switch: {
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
    State: { type: 'i', value: 0x100 }
  },
  tank: {
    'Alarms/High/Active': { type: 'd' },
    'Alarms/High/Delay': { type: 'd' },
    'Alarms/High/Enable': { type: 'd' },
    'Alarms/High/Restore': { type: 'd' },
    'Alarms/High/State': { type: 'd' },
    'Alarms/Low/Active': { type: 'd' },
    'Alarms/Low/Delay': { type: 'd' },
    'Alarms/Low/Enable': { type: 'd' },
    'Alarms/Low/Restore': { type: 'd' },
    'Alarms/Low/State': { type: 'd' },
    Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'm3' : '' },
    FluidType: {
      type: 'i',
      format: (v) => ({
        0: 'Fuel',
        1: 'Fresh water',
        2: 'Waste water',
        3: 'Live well',
        4: 'Oil',
        5: 'Black water (sewage)',
        6: 'Gasoline',
        7: 'Diesel',
        8: 'LPG',
        9: 'LNG',
        10: 'Hydraulic oil',
        11: 'Raw water'
      }[v] || 'unknown'),
      value: 0,
      persist: true
    },
    Level: { type: 'd', format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: 60 },
    RawUnit: { type: 's', persist: true },
    RawValue: { type: 'd' },
    RawValueEmpty: { type: 'd', persist: true },
    RawValueFull: { type: 'd', persist: true },
    Remaining: { type: 'd' },
    Shape: { type: 's', persist: true },
    Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 60 },
    BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    Status: { type: 'i' }
  },
  gps: {
    Altitude: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm' : '' },
    Fix: { type: 'i' },
    NrOfSatellites: { type: 'i' },
    'Position/Latitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: 300 },
    'Position/Longitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: 300 },
    Speed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '' },
    Course: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '°' : '' },
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
  }
}

function getIfaceDesc (dev) {
  const actualDev = dev === 'generator' ? 'genset' : dev
  if (!properties[actualDev]) {
    return {}
  }

  const result = {}

  // Deep copy the properties, including format functions
  for (const [key, value] of Object.entries(properties[dev])) {
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

function getIface (dev) {
  const actualDev = dev === 'generator' ? 'genset' : dev
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

  for (const key in properties[dev]) {
    const propertyValue = JSON.parse(JSON.stringify(properties[dev][key]))

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
      // Fill remaining outputs with null
      for (let i = 1; i < config.outputs; i++) {
        outputs.push(null)
      }
      node.send(outputs)

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
          properties: getIfaceDesc(actualDeviceType),
          signals: {
          }
        }

        // Then we need to create the interface implementation (with actual functions)
        const iface = getIface(actualDeviceType)

        iface.Status = 0
        iface.Serial = node.id || '-'

        let text = `Virtual ${config.device}`

        // Device specific configuration
        switch (config.device) {
          case 'battery': {
            const BATTERY_DEFAULT_VOLTAGES = ['12', '24', '48']
            if (config.battery_capacity != null && !isNaN(Number(config.battery_capacity))) {
              iface.Capacity = Number(config.battery_capacity)
            }
            if (config.default_values) {
              let voltage = 24 // fallback

              if (BATTERY_DEFAULT_VOLTAGES.includes(config.battery_voltage_preset)) {
                voltage = Number(config.battery_voltage_preset)
              } else if (config.battery_voltage_preset === 'custom') {
                if (config.battery_voltage_custom != null &&
                    config.battery_voltage_custom !== '' &&
                    !isNaN(Number(config.battery_voltage_custom))) {
                  voltage = Number(config.battery_voltage_custom)
                }
                // If custom is selected but no valid value provided, use default
              }
              // For any other invalid preset, use default
              iface['Dc/0/Current'] = 0
              iface['Dc/0/Voltage'] = voltage
              iface['Dc/0/Power'] = 0
              iface['Dc/0/Temperature'] = 25
              iface.Soc = 80
              iface.Soh = 100
              iface['System/MinCellVoltage'] = 3.3
            }
            if (!config.include_battery_temperature) {
              delete ifaceDesc.properties['Dc/0/Temperature']
              delete iface['Dc/0/Temperature']
            }

            text = `Virtual ${properties.battery.Capacity.format(iface.Capacity)} battery`
            break
          }

          case 'generator': {
            const generatorType = config.generator_type === 'dc' ? 'dcgenset' : 'genset'
            const nrOfPhases = Number(config.generator_nrofphases ?? 1)

            if (generatorType === 'genset') {
              const properties = [
                { name: 'Current', unit: 'A' },
                { name: 'Power', unit: 'W' },
                { name: 'Voltage', unit: 'V' }
              ]

              for (let i = 1; i <= nrOfPhases; i++) {
                const phase = `L${i}`
                properties.forEach(({ name, unit }) => {
                  const key = `Ac/${phase}/${name}`
                  ifaceDesc.properties[key] = {
                    type: 'd',
                    format: (v) => v != null ? v.toFixed(2) + unit : ''
                  }
                  iface[key] = 0
                })
              }

              iface.NrOfPhases = nrOfPhases
            }

            if (!config.include_engine_hours) {
              delete ifaceDesc.properties['Engine/OperatingHours']
              delete iface['Engine/OperatingHours']
            }
            if (!config.include_starter_voltage) {
              delete ifaceDesc.properties.StarterVoltage
              delete iface.StarterVoltage
              delete ifaceDesc.properties['Alarms/LowStarterVoltage']
              delete iface['Alarms/LowStarterVoltage']
              delete ifaceDesc.properties['Alarms/HighStarterVoltage']
              delete iface['Alarms/HighStarterVoltage']
            }
            if (generatorType === 'dcgenset' && !config.include_history_energy) {
              delete ifaceDesc.properties['History/EnergyOut']
              delete iface['History/EnergyOut']
            }

            if (config.default_values) {
              iface['Engine/Load'] = 0
              iface['Engine/Speed'] = 0
              iface.StatusCode = 0
              iface.State = 0

              if (generatorType === 'dcgenset') {
                iface['Dc/0/Current'] = 0
                iface['Dc/0/Voltage'] = 48
                iface['Dc/0/Power'] = 0
                iface['Dc/0/Temperature'] = 25
                if (config.include_history_energy) {
                  iface['History/EnergyOut'] = 0
                }
              } else {
                iface['Ac/Power'] = 0
                iface['Ac/Energy/Forward'] = 0
              }

              if (config.include_engine_hours) {
                iface['Engine/OperatingHours'] = 0
              }
              if (config.include_starter_voltage) {
                iface.StarterVoltage = 12
              }
            }

            text = `Virtual ${generatorType === 'dcgenset' ? 'DC' : `${nrOfPhases}-phase AC`} generator`
            break
          }

          case 'grid': {
            iface.NrOfPhases = Number(config.grid_nrofphases ?? 1)
            const properties = [
              { name: 'Current', unit: 'A' },
              { name: 'Power', unit: 'W' },
              { name: 'Voltage', unit: 'V' },
              { name: 'Energy/Forward', unit: 'kWh' },
              { name: 'Energy/Reverse', unit: 'kWh' }
            ]
            for (let i = 1; i <= iface.NrOfPhases; i++) {
              const phase = `L${i}`
              properties.forEach(({ name, unit }) => {
                const key = `Ac/${phase}/${name}`
                ifaceDesc.properties[key] = {
                  type: 'd',
                  format: (v) => v != null ? v.toFixed(2) + unit : ''
                }
                iface[key] = 0
              })
            }
            if (config.default_values) {
              iface['Ac/Power'] = 0
              iface['Ac/Frequency'] = 50
              iface['Ac/N/Current'] = 0
            }
            text = `Virtual ${iface.NrOfPhases}-phase grid meter`
            break
          }
          case 'meteo': {
            if (config.default_values) {
              iface.Irradiance = 0
              iface.WindSpeed = 0
            }
            break
          }
          case 'motordrive': {
            // Remove optional properties if not enabled
            if (!config.include_motor_temp) {
              delete ifaceDesc.properties['Motor/Temperature']
              delete iface['Motor/Temperature']
            }
            if (!config.include_controller_temp) {
              delete ifaceDesc.properties['Controller/Temperature']
              delete iface['Controller/Temperature']
            }
            if (!config.include_coolant_temp) {
              delete ifaceDesc.properties['Coolant/Temperature']
              delete iface['Coolant/Temperature']
            }
            if (!config.include_motor_rpm) {
              delete ifaceDesc.properties['Motor/RPM']
              delete iface['Motor/RPM']
            }
            if (!config.include_motor_direction) {
              delete ifaceDesc.properties['Motor/Direction']
              delete iface['Motor/Direction']
            }

            if (config.default_values) {
              iface['Dc/0/Current'] = 0
              iface['Dc/0/Voltage'] = 48
              iface['Dc/0/Power'] = 0

              if (config.include_motor_temp) {
                iface['Motor/Temperature'] = 30
              }
              if (config.include_controller_temp) {
                iface['Controller/Temperature'] = 35
              }
              if (config.include_coolant_temp) {
                iface['Coolant/Temperature'] = 40
              }
              if (config.include_motor_rpm) {
                iface['Motor/RPM'] = 0
              }
              if (config.include_motor_direction) {
                iface['Motor/Direction'] = 0 // Neutral
              }
            }

            text = 'Virtual motor drive'
            // Add RPM and Direction to the node status text if they are enabled
            if (config.include_motor_rpm || config.include_motor_direction) {
              text += ' with'
              if (config.include_motor_rpm) text += ' RPM'
              if (config.include_motor_rpm && config.include_motor_direction) text += ' and'
              if (config.include_motor_direction) text += ' direction'
            }

            break
          }
          case 'pvinverter': {
            iface.Position = Number(config.position ?? 0)
            iface.NrOfPhases = Number(config.pvinverter_nrofphases ?? 1)
            const properties = [
              { name: 'Current', unit: 'A' },
              { name: 'Power', unit: 'W' },
              { name: 'Voltage', unit: 'V' },
              { name: 'Energy/Forward', unit: 'kWh' }
            ]
            for (let i = 1; i <= iface.NrOfPhases; i++) {
              const phase = `L${i}`
              properties.forEach(({ name, unit }) => {
                const key = `Ac/${phase}/${name}`
                ifaceDesc.properties[key] = {
                  type: 'd',
                  format: (v) => v != null ? v.toFixed(2) + unit : ''
                }
                iface[key] = 0
              })
            }
            if (config.default_values) {
              iface['Ac/Power'] = 0
              iface['Ac/MaxPower'] = 1000
              iface['Ac/PowerLimit'] = 1000
              iface['Ac/Energy/Forward'] = 0
              iface.ErrorCode = 0
              iface.StatusCode = 0
            }
            text = `Virtual ${iface.NrOfPhases}-phase pvinverter`
            break
          }
          case 'switch': {
            const baseProperties = [
              { name: 'State', type: 'i', format: (v) => ({ 0: 'Off', 1: 'On' }[v] || 'unknown'), persist: true, immediate: true },
              { name: 'Status', type: 'i', format: (v) => v != null ? v : '', immediate: true },
              { name: 'Name', type: 's', persist: true },
              { name: 'Settings/Group', type: 's', value: '', persist: false },
              { name: 'Settings/CustomName', type: 's', value: '', persist: false },
              {
                name: 'Settings/Type',
                type: 'i',
                format: (v) => SWITCH_TYPE_NAMES[v] || 'unknown',
                persist: false
              },
              { name: 'Settings/ValidTypes', type: 'i', value: 0x7 },
              {
                name: 'Settings/ShowUIControl',
                type: 'i',
                value: 1,
                min: 0,
                max: 6,
                persist: true,
                format: (v) => {
                  if (v === 0) return 'Hidden'
                  const parts = []
                  if (v & 0b001) parts.push('All UIs')
                  if (v & 0b010) parts.push('Local UI')
                  if (v & 0b100) parts.push('Remote UIs')
                  return parts.length > 0 ? parts.join(' + ') : 'Hidden'
                }
              }
            ]

            const switchType = Number(config.switch_1_type ?? 1)

            baseProperties.forEach(({ name, type, value, format, persist, immediate, min, max }) => {
              const switchableOutputPropertyKey = `SwitchableOutput/output_1/${name}`
              ifaceDesc.properties[switchableOutputPropertyKey] = { type, format, persist, immediate, min, max }

              let propValue = value
              if (name === 'Name') {
                // Find the format function for Settings/Type
                const typeProp = baseProperties.find(p => p.name === 'Settings/Type')
                let typeLabel = 'Switch'
                if (typeProp && typeof typeProp.format === 'function') {
                  typeLabel = typeProp.format(switchType)
                }
                propValue = typeLabel
              }
              if (name === 'Settings/Type') propValue = switchType

              iface[switchableOutputPropertyKey] = propValue !== undefined ? propValue : 0

              if (name === 'Settings/ValidTypes') {
                // Only allow the currently selected switch type in the GUI.
                // This sets /Settings/ValidTypes to a bitmask with only the current type allowed.
                // Example: If switchType is 2, then 1 << 2 = 4, so only type 2 is valid.
                iface[switchableOutputPropertyKey] = 1 << switchType
              }
            })

            // Set CustomName and Group from config
            const customNameKey = 'SwitchableOutput/output_1/Settings/CustomName'
            ifaceDesc.properties[customNameKey] = {
              type: 's',
              persist: true
            }
            iface[customNameKey] = config.switch_1_customname || ''

            const groupKey = 'SwitchableOutput/output_1/Settings/Group'
            ifaceDesc.properties[groupKey] = {
              type: 's',
              persist: true
            }
            iface[groupKey] = config.switch_1_group || ''

            if (switchType === 2) {
              const dimmingKey = 'SwitchableOutput/output_1/Dimming'
              ifaceDesc.properties[dimmingKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) + '%' : '',
                min: 0,
                max: 100,
                persist: true,
                immediate: true
              }
              iface[dimmingKey] = 0
            }

            if (switchType === SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT) {
              // Dimming value (°C)
              const dimmingKey = 'SwitchableOutput/output_1/Dimming'
              ifaceDesc.properties[dimmingKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) + '°C' : '',
                min: Number(config.switch_1_min ?? 0),
                max: Number(config.switch_1_max ?? 100),
                persist: true,
                immediate: true
              }
              iface[dimmingKey] = Number(config.switch_1_initial ?? 0)

              // DimmingMin
              const minKey = 'SwitchableOutput/output_1/Settings/DimmingMin'
              ifaceDesc.properties[minKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) + '°C' : ''
              }
              iface[minKey] = Number(config.switch_1_min ?? 0)

              // DimmingMax
              const maxKey = 'SwitchableOutput/output_1/Settings/DimmingMax'
              ifaceDesc.properties[maxKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) + '°C' : ''
              }
              iface[maxKey] = Number(config.switch_1_max ?? 100)

              // StepSize
              const stepKey = 'SwitchableOutput/output_1/Settings/StepSize'
              ifaceDesc.properties[stepKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) + '°C' : ''
              }
              iface[stepKey] = Number(config.switch_1_step ?? 1)

              if (config.switch_1_include_measurement) {
                ifaceDesc.properties['SwitchableOutput/output_1/Measurement'] = {
                  type: 'd',
                  format: (v) => v != null ? v.toFixed(1) + '°C' : '',
                  persist: false
                }
                iface['SwitchableOutput/output_1/Measurement'] = null
              }
            } // Temperature setpoint

            if (switchType === SWITCH_TYPE_MAP.STEPPED) {
              // Stepped switch
              // /SwitchableOutput/x/Dimming holds selected option
              // /SwitchableOutput/x/Settings/DimmingMax defines the number of options (mandatory)
              const dimmingKey = 'SwitchableOutput/output_1/Dimming'
              ifaceDesc.properties[dimmingKey] = {
                type: 'i',
                format: (v) => v != null ? `Option ${v}` : '',
                min: 0,
                max: Number(config.switch_1_max ?? 7),
                persist: true
              }
              iface[dimmingKey] = 0

              const maxKey = 'SwitchableOutput/output_1/Settings/DimmingMax'
              ifaceDesc.properties[maxKey] = {
                type: 'i',
                format: (v) => v != null ? `Options: ${v}` : ''
              }
              iface[maxKey] = Number(config.switch_1_max ?? 7)
            }

            if (switchType === SWITCH_TYPE_MAP.DROPDOWN) {
              const typeKey = 'SwitchableOutput/output_1/Settings/Type'
              const dimmingKey = 'SwitchableOutput/output_1/Dimming'
              const labelsKey = 'SwitchableOutput/output_1/Settings/Labels'

              // Set type to 6 for dropdown
              ifaceDesc.properties[typeKey] = {
                type: 'i',
                format: (v) => v
              }
              iface[typeKey] = 6

              // Get labels from config - should be simple key-value object
              const labels = JSON.parse(config.switch_1_label || '[]')

              // Dimming holds the index of the selected option
              ifaceDesc.properties[dimmingKey] = {
                type: 'i',
                format: (v) => {
                  // Format display using the key-value labels
                  try {
                    const labels = JSON.parse(iface[labelsKey] || '{}')
                    return labels[v] || v || ''
                  } catch (e) {
                    return v || ''
                  }
                }
              }
              iface[dimmingKey] = 0

              // Labels field stores the key-value JSON directly
              ifaceDesc.properties[labelsKey] = {
                type: 'as',
                format: (v) => v || '{}'
              }
              iface[labelsKey] = labels
            }

            if (switchType === SWITCH_TYPE_MAP.BASIC_SLIDER || switchType === SWITCH_TYPE_MAP.NUMERIC_INPUT) {
              const dimmingKey = 'SwitchableOutput/output_1/Dimming'
              ifaceDesc.properties[dimmingKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) : '',
                min: Number(config.switch_1_min ?? 0),
                max: Number(config.switch_1_max ?? 100),
                persist: true
              }
              iface[dimmingKey] = Number(config.switch_1_initial ?? 0)

              // DimmingMin
              const minKey = 'SwitchableOutput/output_1/Settings/DimmingMin'
              ifaceDesc.properties[minKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) : ''
              }
              iface[minKey] = Number(config.switch_1_min ?? 0)

              // DimmingMax
              const maxKey = 'SwitchableOutput/output_1/Settings/DimmingMax'
              ifaceDesc.properties[maxKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) : ''
              }
              iface[maxKey] = Number(config.switch_1_max ?? 100)

              // StepSize
              const stepKey = 'SwitchableOutput/output_1/Settings/StepSize'
              ifaceDesc.properties[stepKey] = {
                type: 'd',
                format: (v) => v != null ? v.toFixed(1) + '°C' : ''
              }
              iface[stepKey] = Number(config.switch_1_step ?? 1)

              const unitKey = 'SwitchableOutput/output_1/Settings/Unit'
              ifaceDesc.properties[unitKey] = {
                type: 's',
                format: (v) => v || ''
              }
              iface[unitKey] = config.switch_1_unit || ''
            }

            if (switchType === SWITCH_TYPE_MAP.THREE_STATE) {
              const autoKey = 'SwitchableOutput/output_1/Auto'
              ifaceDesc.properties[autoKey] = {
                type: 'i',
                format: (v) => v === 1 ? 'Auto' : 'Manual',
                persist: true
              }
              iface[autoKey] = 0
            }

            if (switchType === SWITCH_TYPE_MAP.RGB_COLOR_WHEEL ||
                switchType === SWITCH_TYPE_MAP.CCT_WHEEL ||
                switchType === SWITCH_TYPE_MAP.RGB_WHITE_DIMMER) {
              // LightControls is an array containing [Hue(0-360°), Saturation(0-100%), Brightness(0-100%), White(0-100%), ColorTemperature(0-6500K)]
              // All types use the full 5-element array
              const lightControlKey = 'SwitchableOutput/output_1/LightControls'
              ifaceDesc.properties[lightControlKey] = {
                type: 'ai', // array of integers
                format: (v) => {
                  if (Array.isArray(v) && v.length >= 5) {
                    if (switchType === SWITCH_TYPE_MAP.RGB_COLOR_WHEEL) {
                      return `H:${v[0]}° S:${v[1]}% B:${v[2]}%`
                    } else if (switchType === SWITCH_TYPE_MAP.CCT_WHEEL) {
                      return `B:${v[2]}% CT:${v[4]}K`
                    } else if (switchType === SWITCH_TYPE_MAP.RGB_WHITE_DIMMER) {
                      return `H:${v[0]}° S:${v[1]}% B:${v[2]}% W:${v[3]}%`
                    }
                  }
                  return String(v) || ''
                },
                persist: true
              }
              iface[lightControlKey] = [0, 0, 0, 0, 0] // Default: all zeros

              // Calculate ValidTypes based on selected checkboxes
              const validTypesKey = 'SwitchableOutput/output_1/Settings/ValidTypes'
              let validTypes = 0
              if (config.switch_1_rgb_color_wheel) validTypes |= (1 << SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
              if (config.switch_1_cct_wheel) validTypes |= (1 << SWITCH_TYPE_MAP.CCT_WHEEL)
              if (config.switch_1_rgb_white_dimmer) validTypes |= (1 << SWITCH_TYPE_MAP.RGB_WHITE_DIMMER)

              // Determine the initial RGB type - use first enabled type
              // Default to RGB_COLOR_WHEEL if nothing is selected (and enable it in ValidTypes)
              let rgbSwitchType = SWITCH_TYPE_MAP.RGB_COLOR_WHEEL
              if (config.switch_1_rgb_color_wheel) {
                rgbSwitchType = SWITCH_TYPE_MAP.RGB_COLOR_WHEEL
              } else if (config.switch_1_cct_wheel) {
                rgbSwitchType = SWITCH_TYPE_MAP.CCT_WHEEL
              } else if (config.switch_1_rgb_white_dimmer) {
                rgbSwitchType = SWITCH_TYPE_MAP.RGB_WHITE_DIMMER
              } else {
                // If no checkboxes selected, default to RGB_COLOR_WHEEL and add it to ValidTypes
                validTypes |= (1 << SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
              }

              // Override the Settings/Type to match the first enabled RGB type
              const typeKey = 'SwitchableOutput/output_1/Settings/Type'
              iface[typeKey] = rgbSwitchType

              // Add ValidTypes property definition with formatter
              ifaceDesc.properties[validTypesKey] = {
                type: 'i',
                format: (v) => {
                  if (v == null || v === 0) return 'None'
                  const names = []
                  for (const [bitPosition, name] of Object.entries(SWITCH_TYPE_BITMASK_NAMES)) {
                    if (v & (1 << bitPosition)) {
                      names.push(name)
                    }
                  }
                  return names.length > 0 ? names.join(', ') : 'None'
                }
              }
              iface[validTypesKey] = validTypes
            }

            const switchTypeLabels = {
              [SWITCH_TYPE_MAP.MOMENTARY]: 'Momentary',
              [SWITCH_TYPE_MAP.TOGGLE]: 'Toggle',
              [SWITCH_TYPE_MAP.DIMMABLE]: 'Dimmable',
              [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: 'Temperature setpoint',
              [SWITCH_TYPE_MAP.STEPPED]: 'Stepped',
              [SWITCH_TYPE_MAP.DROPDOWN]: 'Dropdown',
              [SWITCH_TYPE_MAP.BASIC_SLIDER]: 'Basic slider',
              [SWITCH_TYPE_MAP.NUMERIC_INPUT]: 'Numeric input',
              [SWITCH_TYPE_MAP.THREE_STATE]: 'Three-state',
              [SWITCH_TYPE_MAP.BILGE_PUMP]: 'Bilge pump',
              [SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]: 'RGB control',
              [SWITCH_TYPE_MAP.CCT_WHEEL]: 'RGB control',
              [SWITCH_TYPE_MAP.RGB_WHITE_DIMMER]: 'RGB control'
            }
            const typeLabel = switchTypeLabels[switchType] || 'Switch'

            text = `${typeLabel} switch`
            break
          }
          case 'tank':
            iface.FluidType = Number(config.fluid_type ?? 1) // Fresh water
            if (!config.include_tank_battery) {
              delete ifaceDesc.properties.BatteryVoltage
              delete iface.BatteryVoltage
            } else {
              iface.BatteryVoltage = Number(config.tank_battery_voltage ?? 3.3)
            }
            if (!config.include_tank_temperature) {
              delete ifaceDesc.properties.Temperature
              delete iface.Temperature
            }
            if (config.tank_capacity !== '' && config.tank_capacity !== undefined) {
              const capacity = Number(config.tank_capacity)
              if (isNaN(capacity) || capacity <= 0) {
                node.error('Tank capacity must be greater than 0')
                return
              }
              iface.Capacity = capacity
            }
            if (config.default_values) {
              iface.Level = 50
              iface.Temperature = 25
            }
            text = `Virtual ${properties.tank.FluidType.format(iface.FluidType).toLowerCase()} tank sensor`
            break
          case 'temperature':
            iface.TemperatureType = Number(config.temperature_type ?? 2) // Generic
            // Remove optional properties if not enabled
            if (!config.include_humidity) {
              delete ifaceDesc.properties.Humidity
              delete iface.Humidity
            }
            if (!config.include_pressure) {
              delete ifaceDesc.properties.Pressure
              delete iface.Pressure
            }
            if (!config.include_temp_battery) {
              delete ifaceDesc.properties.BatteryVoltage
              delete iface.BatteryVoltage
            } else {
              iface.BatteryVoltage = Number(config.temp_battery_voltage ?? 3.3)
            }
            if (config.default_values) {
              iface.Temperature = 25
              iface.Humidity = 50
              iface.Pressure = 1013
            }
            text = `Virtual ${properties.temperature.TemperatureType.format(iface.TemperatureType).toLowerCase()} temperature sensor`
            break
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
            // Store serviceName on node for cleanup during close
            node.serviceName = serviceName
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
          const propValue = data[0][1][0][1][1]

          // check if we need to persist this property
          if (ifaceDesc.properties[propName] && ifaceDesc.properties[propName].persist) {
            savePersistedState(RED, self.id, iface, ifaceDesc, propName).catch(err => {
              console.error(`Failed to persist state for ${propName}:`, err)
            })
          }

          if (config.device !== 'switch' || config.outputs <= 1) {
            return
          }

          if (!node.lastSentValues) {
            node.lastSentValues = {}
          }

          const outputMsgs = []
          let hasChanges = false
          const switchType = parseInt(config.switch_1_type, 10)

          // Output 1: null (no passthrough on ItemsChanged)
          outputMsgs[0] = null

          const secondOutputLabel = SWITCH_SECOND_OUTPUT_LABEL[switchType] || 'State'

          // Handle output 2 based on switch type
          if (config.outputs >= 2) {
            // Check if this is a switch type with special second output (not "State")
            const hasSpecialSecondOutput = SWITCH_SECOND_OUTPUT_LABEL[switchType] !== undefined

            if (hasSpecialSecondOutput && secondOutputLabel !== 'State') {
              // These switches (Temperature, Dropdown, Basic Slider) output their value directly
              if (propName === 'SwitchableOutput/output_1/Dimming') {
                if (node.lastSentValues.Dimming !== propValue) {
                  node.lastSentValues.Dimming = propValue
                  const topicSuffix = secondOutputLabel.toLowerCase()
                  outputMsgs[1] = {
                    payload: Number(propValue),
                    topic: `${node.name || 'Virtual ' + config.device}/${topicSuffix}`,
                    path: '/SwitchableOutput/output_1/Dimming'
                  }
                  hasChanges = true
                }
              } else {
                outputMsgs[1] = null
              }
            } else {
              // Standard switches: Output 2 = State
              if (propName === 'SwitchableOutput/output_1/State') {
                if (node.lastSentValues.State !== propValue) {
                  node.lastSentValues.State = propValue
                  outputMsgs[1] = {
                    payload: propValue,
                    topic: `${node.name || 'Virtual ' + config.device}/state`,
                    path: '/SwitchableOutput/output_1/State'
                  }
                  hasChanges = true
                }
              } else {
                outputMsgs[1] = null
              }
            }
          }

          // Handle output 3 (only for 3-output switches)
          if (config.outputs >= 3) {
            // Handle Dimming for dimmable, stepped, and numeric input switches
            if (propName === 'SwitchableOutput/output_1/Dimming') {
              if (node.lastSentValues.Dimming !== propValue) {
                node.lastSentValues.Dimming = propValue

                const topicLabel = SWITCH_THIRD_OUTPUT_LABEL[switchType] || 'value'

                outputMsgs[2] = {
                  payload: propValue,
                  topic: `${node.name || 'Virtual ' + config.device}/${topicLabel.toLowerCase()}`,
                  path: '/SwitchableOutput/output_1/Dimming'
                }
                hasChanges = true
              }
            } else if (propName === 'SwitchableOutput/output_1/LightControls') {
              // Handle LightControls for RGB control types
              // propValue is already an array of integers from D-Bus
              const currentValue = JSON.stringify(node.lastSentValues.LightControls)
              const newValue = JSON.stringify(propValue)

              if (currentValue !== newValue) {
                node.lastSentValues.LightControls = propValue

                const topicLabel = SWITCH_THIRD_OUTPUT_LABEL[switchType] || 'lightcontrols'

                // Convert HSB to RGB for convenience
                const [hue, saturation, brightness, white, colorTemp] = propValue
                const rgb = hsbToRgb(hue, saturation, brightness)

                outputMsgs[2] = {
                  payload: propValue, // Send the array directly
                  topic: `${node.name || 'Virtual ' + config.device}/${topicLabel.toLowerCase()}`,
                  path: '/SwitchableOutput/output_1/LightControls',
                  rgb, // RGB as #RRGGBB string
                  hsb: { hue, saturation, brightness }, // HSB object
                  white, // White level (0-100%)
                  colorTemperature: colorTemp // Color temperature in Kelvin
                }
                hasChanges = true
              }
            } else {
              outputMsgs[2] = null
            }
          }

          // Send outputs only if there were actual changes
          if (hasChanges) {
            node.send(outputMsgs)
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
