const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const { needsPersistedState, hasPersistedState, loadPersistedState, savePersistedState } = require('./persist')
const dbus = require('dbus-native-victron')
const debug = require('debug')('victron-virtual')
const debugConnection = require('debug')('victron-virtual:connection')

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

const properties = {
  battery: {
    Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'Ah' : '', persist: true },
    'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    'Info/BatteryLowVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Info/MaxChargeVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Info/MaxChargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Info/MaxDischargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Info/ChargeRequest': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    Soc: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: 15 /* persist, but throttled to 15 seconds */ },
    Soh: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: 60 /* persist, but throttled to 60 seconds */ },
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
    'Alarms/CellImbalance': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/HighCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/HighChargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/HighCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/HighDischargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/HighTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/HighVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/InternalFailure': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/LowCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/LowSoc': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/LowTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/LowVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'Alarms/StateOfHealth': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    NrOfDistributors: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    'System/MinCellVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'V' : '' }
  },
  temperature: {
    Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 60 /* persist, but throttled to 60 seconds */ },
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
    Pressure: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'hPa' : '' },
    Humidity: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '%' : '' },
    BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    Status: { type: 'i', persist: true /* persist on every state change */ }
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
    CellTemperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    ExternalTemperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    Irradiance: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'W/m2' : '' },
    WindSpeed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '' },
    WindDirection: { type: 'i' }
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
      value: 0
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
      value: 0
    },
    Level: { type: 'd', format: (v) => v != null ? v.toFixed(0) + '%' : '' },
    RawUnit: { type: 's' },
    RawValue: { type: 'd' },
    RawValueEmpty: { type: 'd' },
    RawValueFull: { type: 'd' },
    Remaining: { type: 'd' },
    Shape: { type: 's' },
    Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    Status: { type: 'i' }
  },
  gps: {
    Altitude: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm' : '' },
    Fix: { type: 'i' },
    NrOfSatellites: { type: 'i' },
    'Position/Latitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '' },
    'Position/Longitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '' },
    Speed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '' },
    Course: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '°' : '' },
    Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
  }
}

function getIfaceDesc (dev) {
  if (!properties[dev]) {
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
  if (!properties[dev]) {
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

    const address = process.env.NODE_RED_DBUS_ADDRESS
      ? process.env.NODE_RED_DBUS_ADDRESS.split(':')
      : null
    if (address && address.length === 2) {
      this.address = `tcp:host=${address[0]},port=${address[1]}`
    }

    function instantiateDbus (self) {
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

      let serviceName = `com.victronenergy.${config.device}.virtual_${self.id}`
      // For relays, we only add services, setting the serviceName to this (will result in 0x3 code)
      if (config.device === 'relay') {
        serviceName = 'com.victronenergy.settings'
      }

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
          properties: getIfaceDesc(config.device),
          signals: {
          }
        }

        // Then we need to create the interface implementation (with actual functions)
        const iface = getIface(config.device)

        iface.Status = 0
        iface.Serial = node.id || '-'

        let text = `Virtual ${config.device}`

        // Device specific configuration
        switch (config.device) {
          case 'battery': {
            if (config.battery_capacity != null && !isNaN(Number(config.battery_capacity))) {
              iface.Capacity = Number(config.battery_capacity)
            }
            if (config.default_values) {
              iface['Dc/0/Current'] = 0
              iface['Dc/0/Voltage'] = 24
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
            const properties = [
              {
                name: 'State',
                type: 'i',
                format: (v) => ({
                  0: 'Off',
                  1: 'On'
                }[v] || 'unknown'),
                persist: true
              },
              { name: 'Status', type: 'i', format: (v) => v != null ? v : '' },
              { name: 'Name', type: 's', value: 'Output', persist: true },
              { name: 'Settings/Group', type: 's', value: '', persist: true },
              { name: 'Settings/CustomName', type: 's', value: '', persist: true },
              {
                name: 'Settings/Type',
                type: 'i',
                format: (v) => ({
                  0: 'Momentary',
                  1: 'Latching/Relay',
                  2: 'Dimmable/PWM'
                }[v] || 'unknown'),
                value: 1,
                persist: true
              },
              { name: 'Settings/ValidTypes', type: 'i', value: 0x3 }
            ]
            for (let i = 1; i <= Number(config.switch_nrofoutput ?? 0); i++) {
              properties.forEach(({ name, type, value, format, persist }) => {
                const key = `SwitchableOutput/output_${i}/${name}`
                ifaceDesc.properties[key] = {
                  type, format, persist
                }
                if (name === 'Name') {
                  value += ` ${i}`
                }
                iface[key] = value !== undefined ? value : 0
              })
            }
            properties.push({
              name: 'Dimming',
              min: 0,
              max: 100,
              type: 'd',
              format: (v) => v != null ? v.toFixed(1) + '%' : '',
              persist: true
            })
            for (let i = 1; i <= Number(config.switch_nrofpwm ?? 0); i++) {
              properties.forEach(({ name, type, value, format, min, max, persist }) => {
                const key = `SwitchableOutput/pwm_${i}/${name}`
                ifaceDesc.properties[key] = {
                  type, format, persist
                }
                if (min != null) {
                  ifaceDesc.properties[key].min = min
                }
                if (max != null) {
                  ifaceDesc.properties[key].max = max
                }
                if (name === 'Settings/ValidTypes') {
                  value = 0x4 // Only dimmable
                }
                if (name === 'Settings/Type') {
                  value = 2 // Set to dimmable
                }
                if (name === 'Name') {
                  value = `PWM ${i}`
                }
                iface[key] = value !== undefined ? value : 0
              })
            }
            text = `Virtual switch ${config.switch_nrofoutput} outputs, ${config.switch_nrofpwm} PWMs`
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
            savePersistedState(RED, self.id, iface, ifaceDesc, propName).then(() => {
              debug(`Saved state for virtual device ${config.device} (${self.id}), because ${propName} changed to ${iface[propName]}`)
            }).catch(err => {
              console.error(`Failed to persist state for ${propName}:`, err)
            })
          }
        }

        // Then we can add the required Victron interfaces, and receive some functions to use
        const {
          removeSettings,
          getValue
        } = addVictronInterfaces(usedBus, ifaceDesc, iface, /* add_defaults */ true, emitCallback)

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

      // If this was the last instance and the timeout is still pending
      if (nodeInstances.size === 0) {
        if (globalTimeoutHandle) {
          clearTimeout(globalTimeoutHandle)
          globalTimeoutHandle = null
        }
        // Only end the connection when closing the last instance
        this.bus.connection.end()
        hasRunOnce = false
      }

      done()
    })
  }

  RED.nodes.registerType('victron-virtual', VictronVirtualNode)
}
