const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const dbus = require('dbus-native-victron')
const debug = require('debug')('victron-virtual')

const properties = {
  battery: {
    Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'Ah' : '' },
    'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    'Info/BatteryLowVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Info/MaxChargeVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Info/MaxChargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Info/MaxDischargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Info/ChargeRequest': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    Soc: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '' },
    Soh: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '' },
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
    Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
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
    Status: { type: 'i' }
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
  result.CustomName = { type: 's' }
  result.Serial = { type: 's' }

  return result
}

function getIface (dev) {
  if (!properties[dev]) {
    return { emit: function () { } }
  }

  const result = { emit: function () { } }

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

function setupVirtualSwitch (config, iface, ifaceDesc, node, persistentStorage, pathsToTrack, settingsKeysToTrack) {
  const switchData = {
    outputKeys: [],
    pwmKeys: []
  }

  for (let i = 1; i <= Number(config.switch_nrofoutput ?? 0); i++) {
    settingsKeysToTrack.push(`SwitchableOutput/output_${i}/State`)
    settingsKeysToTrack.push(`SwitchableOutput/output_${i}/Settings/CustomName`)
    settingsKeysToTrack.push(`SwitchableOutput/output_${i}/Settings/Group`)
  }

  for (let i = 1; i <= Number(config.switch_nrofpwm ?? 0); i++) {
    settingsKeysToTrack.push(`SwitchableOutput/pwm_${i}/Dimming`)
    settingsKeysToTrack.push(`SwitchableOutput/pwm_${i}/Settings/CustomName`)
    settingsKeysToTrack.push(`SwitchableOutput/pwm_${i}/Settings/Group`)
  }

  setupSwitchProperties(config, iface, ifaceDesc, switchData)
  setupSwitchPathsToTrack(config, pathsToTrack)

  if (persistentStorage) {
    const persistenceKey = `victron-virtual-device-${node.id}`
    setupSwitchStateMonitoring(iface, node, persistentStorage, persistenceKey, switchData)
    initializeSwitchState(config, iface, node, persistentStorage, switchData)
  } else {
    // console.info('No persistence available for switch, applying initial states');
    applySwitchConfiguredInitialStates(config, iface, switchData)
  }

  return {
    text: `Virtual switch: ${config.switch_nrofoutput} switch(es), ${config.switch_nrofpwm} slider(s)`,
    data: switchData
  }
}

function setupSwitchProperties (config, iface, ifaceDesc, switchData) {
  const properties = [
    {
      name: 'State',
      type: 'i',
      format: (v) => ({
        0: 'Off',
        1: 'On'
      }[v] || 'unknown')
    },
    { name: 'Status', type: 'i', format: (v) => v != null ? v : '' },
    { name: 'Name', type: 's', value: 'Output' },
    { name: 'Settings/Group', type: 's', value: '' },
    { name: 'Settings/CustomName', type: 's', value: '' },
    {
      name: 'Settings/Type',
      type: 'i',
      format: (v) => ({
        0: 'Momentary',
        1: 'Latching/Relay',
        2: 'Dimmable/PWM'
      }[v] || 'unknown'),
      value: 1
    },
    { name: 'Settings/ValidTypes', type: 'i', value: 0x3 }
  ]

  for (let i = 1; i <= Number(config.switch_nrofoutput ?? 0); i++) {
    properties.forEach(({ name, type, value }) => {
      const key = `SwitchableOutput/output_${i}/${name}`
      ifaceDesc.properties[key] = { type }

      if (name === 'Name') {
        value += ` ${i}`
      }

      if (name === 'Settings/Type' && config.switch_output_types) {
        const typeVal = parseInt(config.switch_output_types[i], 10)
        value = (typeVal === 0) ? 0 : 1
      }

      iface[key] = value !== undefined ? value : 0

      if (name === 'State') {
        switchData.outputKeys.push(key)
      }
    })
  }

  properties.push({
    name: 'Dimming',
    min: 0,
    max: 100,
    type: 'd',
    format: (v) => v != null ? v.toFixed(1) + '%' : ''
  })

  for (let i = 1; i <= Number(config.switch_nrofpwm ?? 0); i++) {
    properties.forEach(({ name, type, value, format, min, max }) => {
      const key = `SwitchableOutput/pwm_${i}/${name}`
      ifaceDesc.properties[key] = { type, format }

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
        value = `Slider ${i}`
      }
      if (name === 'Dimming') {
        switchData.pwmKeys.push(key)
      }
      iface[key] = value !== undefined ? value : 0
    })
  }
}

function setupSwitchPathsToTrack (config, pathsToTrack) {
  if (config.switch_output_initial_states) {
    for (let i = 1; i <= Number(config.switch_nrofoutput ?? 0); i++) {
      const stateKey = `SwitchableOutput/output_${i}/State`
      const initialSetting = config.switch_output_initial_states[i]

      if (initialSetting === 'previous' || initialSetting === undefined) {
        pathsToTrack.push(stateKey)
      }

      pathsToTrack.push(`SwitchableOutput/output_${i}/Settings/CustomName`)
      pathsToTrack.push(`SwitchableOutput/output_${i}/Settings/Group`)
    }
  } else {
    for (let i = 1; i <= Number(config.switch_nrofoutput ?? 0); i++) {
      pathsToTrack.push(`SwitchableOutput/output_${i}/State`)
      pathsToTrack.push(`SwitchableOutput/output_${i}/Settings/CustomName`)
      pathsToTrack.push(`SwitchableOutput/output_${i}/Settings/Group`)
    }
  }

  if (config.switch_pwm_initial_states) {
    for (let i = 1; i <= Number(config.switch_nrofpwm ?? 0); i++) {
      const dimmingKey = `SwitchableOutput/pwm_${i}/Dimming`
      const initialSetting = config.switch_pwm_initial_states[i]

      if (!initialSetting || initialSetting.type === 'previous') {
        pathsToTrack.push(dimmingKey)
      }

      pathsToTrack.push(`SwitchableOutput/pwm_${i}/Settings/CustomName`)
      pathsToTrack.push(`SwitchableOutput/pwm_${i}/Settings/Group`)
    }
  } else {
    for (let i = 1; i <= Number(config.switch_nrofpwm ?? 0); i++) {
      pathsToTrack.push(`SwitchableOutput/pwm_${i}/Dimming`)
      pathsToTrack.push(`SwitchableOutput/pwm_${i}/Settings/CustomName`)
      pathsToTrack.push(`SwitchableOutput/pwm_${i}/Settings/Group`)
    }
  }
}

function setupSwitchStateMonitoring (iface, node, persistentStorage, persistenceKey, switchData) {
  const originalEmit = iface.emit

  iface.emit = function (propName, newValue) {
    const currentData = node.context().get(persistenceKey, persistentStorage) || {}

    if (!currentData.switches) {
      currentData.switches = {}
    }

    if (propName === 'CustomName') {
      currentData.CustomName = newValue
      // console.info(`Saved CustomName change: ${newValue}`);
    }

    if (switchData.outputKeys.includes(propName) ||
      switchData.pwmKeys.includes(propName) ||
      propName.includes('/Settings/CustomName') ||
      propName.includes('/Settings/Group')) {
      currentData.switches[propName] = newValue
      // console.info(`Saved state change: ${propName} = ${newValue}`);
    }

    node.context().set(persistenceKey, currentData, persistentStorage)

    return originalEmit.apply(this, arguments)
  }
}

function initializeSwitchState (config, iface, node, persistentStorage, switchData) {
  const persistenceKey = `victron-virtual-device-${node.id}`
  const savedData = node.context().get(persistenceKey, persistentStorage)

  if (!savedData || !savedData.switches || Object.keys(savedData.switches).length === 0) {
    // console.info('No saved switch data found, applying configured initial states');
    applySwitchConfiguredInitialStates(config, iface, switchData)
  } else {
    // console.info(`Loading saved switch data: ${JSON.stringify(savedData)}`);
    const appliedSaved = applySwitchSavedStates(savedData, iface, switchData, config)
    if (!appliedSaved) {
      applySwitchConfiguredInitialStates(config, iface, switchData)
    }
  }
}

function applySwitchSavedStates (savedData, iface, switchData, config) {
  if (!savedData || !savedData.switches) return false

  const switchStates = savedData.switches
  let appliedAny = false

  switchData.outputKeys.forEach((key, idx) => {
    const outputNum = idx + 1
    const initialSetting = config.switch_output_initial_states && config.switch_output_initial_states[outputNum]
    if (!initialSetting || initialSetting === 'previous') {
      if (switchStates[key] !== undefined) {
        iface[key] = switchStates[key]
        // console.info(`Applied saved state for output ${key}: ${switchStates[key]}`);
        if (typeof iface.emit === 'function') {
          iface.emit(key, switchStates[key])
        }
        appliedAny = true
      }
    }
  })

  switchData.pwmKeys.forEach((key, idx) => {
    const pwmNum = idx + 1
    const initialSetting = config.switch_pwm_initial_states && config.switch_pwm_initial_states[pwmNum]
    if (!initialSetting || initialSetting === 'previous') {
      if (switchStates[key] !== undefined) {
        iface[key] = switchStates[key]
        // console.info(`Applied saved state for PWM ${key}: ${switchStates[key]}`);
        if (typeof iface.emit === 'function') {
          iface.emit(key, switchStates[key])
        }
        appliedAny = true
      }
    }
  })

  for (let i = 1; i <= Number(config.switch_nrofoutput ?? 0); i++) {
    const customNameKey = `SwitchableOutput/output_${i}/Settings/CustomName`
    const groupKey = `SwitchableOutput/output_${i}/Settings/Group`

    if (switchStates[customNameKey] !== undefined) {
      iface[customNameKey] = switchStates[customNameKey]
      // console.info(`Applied saved CustomName for output ${i}: ${switchStates[customNameKey]}`);
      if (typeof iface.emit === 'function') {
        iface.emit(customNameKey, switchStates[customNameKey])
      }
      appliedAny = true
    }

    if (switchStates[groupKey] !== undefined) {
      iface[groupKey] = switchStates[groupKey]
      // console.info(`Applied saved Group for output ${i}: ${switchStates[groupKey]}`);
      if (typeof iface.emit === 'function') {
        iface.emit(groupKey, switchStates[groupKey])
      }
      appliedAny = true
    }
  }

  for (let i = 1; i <= Number(config.switch_nrofpwm ?? 0); i++) {
    const customNameKey = `SwitchableOutput/pwm_${i}/Settings/CustomName`
    const groupKey = `SwitchableOutput/pwm_${i}/Settings/Group`

    if (switchStates[customNameKey] !== undefined) {
      iface[customNameKey] = switchStates[customNameKey]
      // console.info(`Applied saved CustomName for PWM ${i}: ${switchStates[customNameKey]}`);
      if (typeof iface.emit === 'function') {
        iface.emit(customNameKey, switchStates[customNameKey])
      }
      appliedAny = true
    }

    if (switchStates[groupKey] !== undefined) {
      iface[groupKey] = switchStates[groupKey]
      // console.info(`Applied saved Group for PWM ${i}: ${switchStates[groupKey]}`);
      if (typeof iface.emit === 'function') {
        iface.emit(groupKey, switchStates[groupKey])
      }
      appliedAny = true
    }
  }
  return appliedAny
}

function applySwitchConfiguredInitialStates (config, iface, switchData) {
  console.info('Applying configured initial states for switch')

  if (config.switch_output_initial_states) {
    switchData.outputKeys.forEach((key, idx) => {
      const outputNum = idx + 1
      const initialSetting = config.switch_output_initial_states[outputNum]

      if (initialSetting === 'on') {
        iface[key] = 1
        // console.info(`Applied configured initial state for ${key}: ON (1)`);
      } else if (initialSetting === 'null') {
        iface[key] = null
        // console.info(`Applied configured initial state for ${key}: NULL`);
      } else if (initialSetting === 'off') {
        iface[key] = 0
        // console.info(`Applied configured initial state for ${key}: OFF (0)`);
      }
    })
  }

  if (config.switch_pwm_initial_states) {
    switchData.pwmKeys.forEach((key, idx) => {
      const pwmNum = idx + 1
      const initialSetting = config.switch_pwm_initial_states[pwmNum]

      if (!initialSetting) return

      if (initialSetting.type === 'off') {
        iface[key] = 0
        // console.info(`Applied configured initial state for ${key}: OFF (0%)`);
      } else if (initialSetting.type === 'custom') {
        iface[key] = initialSetting.value || 0
        // console.info(`Applied configured initial state for ${key}: ${initialSetting.value || 0}%`);
      }
    })
  }
}

module.exports = function (RED) {
  // Shared state across all instances
  let hasRunOnce = false
  let globalTimeoutHandle = null
  const nodeInstances = new Set()
  let settingsKeysToTrack = []

  function VictronVirtualNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

    let persistentStorage = null
    const availableStorageModules = RED.settings.contextStorage || {}
    const fileStorageKey = Object.keys(availableStorageModules).find(
      key => availableStorageModules[key].module === 'localfilesystem'
    )

    if (fileStorageKey) {
      persistentStorage = fileStorageKey
      console.info(`Using persistent context storage: ${persistentStorage}`)
    } else {
      console.info('No file-based context storage found in settings.js. Device states will not persist across restarts.')
    }

    // Default paths to track for all devices
    const pathsToTrack = ['CustomName']
    settingsKeysToTrack = ['CustomName'] // Track CustomName for all devices

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
          text: 'Could not initialize DBus.'
        })
        return
      }
      // TODO: we are not really connected yet
      console.log('connected to dbus, address:', self.address, 'device:', config.device)

      self.bus.connection.on('end', () => {
        node.status({
          color: 'red',
          shape: 'dot',
          text: 'DBus connection closed'
        })

        // TODO: same wait logic as below
        new Promise(resolve => setTimeout(resolve, 1000)).then(() => {
          console.warn('trying to re-instantiate dbus...')
          instantiateDbus(self)
        })
      })
      self.bus.connection.on('error', (err) => {
        console.error('DBus connection error:', err)
        node.status({
          color: 'red',
          shape: 'dot',
          text: 'DBus connection error'
        })
        new Promise(resolve => setTimeout(resolve, 1000)).then(() => {
          console.warn('trying to re-instantiate dbus...')
          instantiateDbus(self)
        })
      })
    }

    instantiateDbus(this)

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

    let serviceName = `com.victronenergy.${config.device}.virtual_${this.id}`
    // For relays, we only add services, setting the serviceName to this (will result in 0x3 code)
    if (config.device === 'relay') {
      serviceName = 'com.victronenergy.settings'
    }

    const interfaceName = serviceName
    const objectPath = `/${serviceName.replace(/\./g, '/')}`

    // here we need to change stuff
    async function proceed (usedBus) {
      function loadPersistentData () {
        if (!persistentStorage) return false

        const persistenceKey = `victron-virtual-device-${node.id}`
        const savedData = node.context().get(persistenceKey, persistentStorage)

        if (!savedData) return false

        if (savedData.CustomName) {
          iface.CustomName = savedData.CustomName
          // console.warn(`Loaded saved CustomName: ${savedData.CustomName}`)
        }

        if (config.device === 'switch') {
          if (savedData.switches) {
            Object.entries(savedData.switches).forEach(([key, value]) => {
              if (key in iface) {
                iface[key] = value
                // console.warn(`Applied saved value for ${key}: ${value}`)
                if (typeof iface.emit === 'function') {
                  iface.emit(key, value)
                }
              }
            })
            return true
          }
        }

        return !!savedData
      }

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

      // Note: We'll set CustomName after trying to load persistent data
      iface.Status = 0
      iface.Serial = node.id || '-'

      let text = `Virtual ${config.device}`

      if (config.device === 'switch') {
        // Find available file-based storage modules
        const availableStorageModules = RED.settings.contextStorage || {}
        const fileStorageKey = Object.keys(availableStorageModules).find(
          key => availableStorageModules[key].module === 'localfilesystem'
        )

        if (fileStorageKey) {
          persistentStorage = fileStorageKey
          // console.warn(`Using persistent context storage: ${persistentStorage}`)
        } else {
          console.warn('No file-based context storage found in settings.js. Switch states will not persist across restarts.')
        }
      }

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
          const switchResult = setupVirtualSwitch(config, iface, ifaceDesc, node, persistentStorage, pathsToTrack, settingsKeysToTrack)

          text = switchResult.text
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

      function applyConfiguredInitialStates () {
        // console.warn('Applying configured initial states')

        if (config.device === 'switch') {
          if (config.switch_output_initial_states) {
            for (let i = 1; i <= Number(config.switch_nrofoutput ?? 0); i++) {
              const stateKey = `SwitchableOutput/output_${i}/State`
              const initialSetting = config.switch_output_initial_states[i]

              if (initialSetting === 'on') {
                iface[stateKey] = 1
                // console.warn(`Applied configured initial state for ${stateKey}: ON`)
              } else if (initialSetting === 'off') {
                iface[stateKey] = 0
                // console.warn(`Applied configured initial state for ${stateKey}: OFF`)
              }
            }
          }

          if (config.switch_pwm_initial_states) {
            for (let i = 1; i <= Number(config.switch_nrofpwm ?? 0); i++) {
              const dimmingKey = `SwitchableOutput/pwm_${i}/Dimming`
              const initialSetting = config.switch_pwm_initial_states[i]

              if (!initialSetting) continue

              if (initialSetting.type === 'off') {
                iface[dimmingKey] = 0
                // console.warn(`Applied configured initial state for ${dimmingKey}: 0%`)
              } else if (initialSetting.type === 'custom') {
                iface[dimmingKey] = initialSetting.value || 0
                // console.warn(`Applied configured initial state for ${dimmingKey}: ${initialSetting.value || 0}%`)
              }
            }
          }
        }
      }

      if (persistentStorage) {
        const persistenceKey = `victron-virtual-device-${node.id}`

        function setupPersistence () {
          const originalEmit = iface.emit

          iface.emit = function (propName, newValue) {
            if (pathsToTrack.includes(propName)) {
              const currentData = node.context().get(persistenceKey, persistentStorage) || {}
              currentData[propName] = newValue
              node.context().set(persistenceKey, currentData, persistentStorage)
              // console.warn(`Saved state change: ${propName} = ${newValue}`)
            }

            return originalEmit.apply(this, arguments)
          }
        }

        function loadSavedData () {
          const savedData = node.context().get(persistenceKey, persistentStorage)
          if (!savedData || Object.keys(savedData).length === 0) {
            console.info('No saved data found, applying configured initial states')
            applyConfiguredInitialStates()
            return { loaded: false }
          }

          console.warn(`Loading saved data for ${config.device}: ${JSON.stringify(savedData)}`)
          applyConfiguredInitialStates()

          Object.entries(savedData).forEach(([key, value]) => {
            if (key in iface && pathsToTrack.includes(key)) {
              iface[key] = value
              // console.warn(`Applied saved value for ${key}: ${value}`)
              if (typeof iface.emit === 'function') {
                iface.emit(key, value)
              }
            }
          })

          return { loaded: true, data: savedData }
        }

        setupPersistence()

        const result = loadSavedData()

        if (!result.loaded || !result.data.CustomName) {
          iface.CustomName = config.name || `Virtual ${config.device}`
        }
      } else {
        console.info('No persistence available, applying initial states')
        applyConfiguredInitialStates()
        iface.CustomName = config.name || `Virtual ${config.device}`
      }

      // First we use addSettings to claim a deviceInstance
      const settingsResult = await addSettings(usedBus, [
        {
          path: `/Settings/Devices/virtual_${node.id}/ClassAndVrmInstance`,
          default: `${config.device}:100`,
          type: 's'
        }
      ])

      // It looks like there are a few posibilities here:
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

      // Try to load persistent data for CustomName or set default
      const loadedData = loadPersistentData()
      if (!loadedData) {
        iface.CustomName = config.name || `Virtual ${config.device}`
      }

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

      // Then we can add the required Victron interfaces, and receive some functions to use
      const {
        removeSettings,
        getValue
      } = addVictronInterfaces(usedBus, ifaceDesc, iface)

      console.log(`added interface ${ifaceDesc.name} to ${objectPath}`)

      usedBus.connection.on('end', () => console.warn(`DBus connection ended, should re-add interface ${ifaceDesc.name} to ${objectPath}`))

      if (persistentStorage) {
        const devicePersistenceKey = `victron-virtual-device-${node.id}`
        const originalEmit = iface.emit

        iface.emit = function (propName, newValue) {
          if (propName === 'CustomName') {
            const currentData = node.context().get(devicePersistenceKey, persistentStorage) || {}
            currentData.CustomName = newValue
            node.context().set(devicePersistenceKey, currentData, persistentStorage)
            // console.warn(`Saved CustomName change: ${newValue}`)
          }
          return originalEmit.apply(this, arguments)
        }
      }

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
    proceed(this.bus)

    node.on('input', function (msg) {
    })

    node.on('close', function (done) {
      if (persistentStorage && node.iface) {
        const persistenceKey = `victron-virtual-device-${node.id}`
        const deviceData = {}

        pathsToTrack.forEach(path => {
          if (path in node.iface) {
            deviceData[path] = node.iface[path]
          }
        })

        node.context().set(persistenceKey, deviceData, persistentStorage)
        console.info(`Saved device data on close: ${JSON.stringify(deviceData)}`)
      }

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
