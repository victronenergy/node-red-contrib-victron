/**
 * Switch device type for Victron Virtual nodes
 */
const debug = require('debug')('victron-virtual:switch')
const utils = require('../utils')
const persistence = require('../persistence')

/**
 * Base switch properties definition
 */
const switchBaseProperties = {
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  State: { type: 'i', value: 0x100 }
}

/**
 * Get interface description for switch device
 * @param {Object} config - Node configuration
 * @returns {Object} Interface description with properties
 */
function getInterfaceDescription(config) {
  const ifaceDesc = utils.createBaseInterfaceDescription()
  const properties = utils.deepClone(switchBaseProperties)
  
  return { ...ifaceDesc, ...properties }
}

/**
 * Get initial interface implementation with default values
 * @param {Object} config - Node configuration
 * @returns {Object} Interface with initial values
 */
function getInterface(config) {
  const iface = { emit: function () {} }
  
  // Set initial values from properties definition
  for (const key in switchBaseProperties) {
    const propertyValue = { ...switchBaseProperties[key] }
    
    if (propertyValue.value !== undefined) {
      iface[key] = propertyValue.value
    } else {
      switch (propertyValue.type) {
        case 's':
          iface[key] = '-'
          break
        default:
          iface[key] = null
      }
    }
  }
  
  return iface
}

/**
 * Set up device-specific configuration
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface
 * @param {Object} ifaceDesc - Interface description
 * @param {Object} node - Node instance
 * @param {Object} context - Context with persistence info
 * @returns {Object} Setup result with switch data
 */
function setupDevice(config, iface, ifaceDesc, node, context) {
  const switchData = {
    outputKeys: [],
    pwmKeys: []
  }
  
  const { pathsToTrack, settingsKeysToTrack, persistentStorage } = context
  
  // Add settings keys to track
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
  
  // Set up switch properties
  setupSwitchProperties(config, iface, ifaceDesc, switchData)
  
  // Add tracking paths
  setupSwitchPathsToTrack(config, pathsToTrack)
  
  // Set up persistence if available
  if (persistentStorage) {
    persistence.setupSwitchPersistence(iface, node, persistentStorage, switchData, config)
    const savedData = persistence.loadSavedData(node, persistentStorage)
    
    if (savedData && savedData.switches) {
      const appliedSaved = applySwitchSavedStates(savedData, iface, switchData, config)
      if (!appliedSaved) {
        applySwitchConfiguredInitialStates(config, iface, switchData)
      }
    } else {
      applySwitchConfiguredInitialStates(config, iface, switchData)
    }
  } else {
    applySwitchConfiguredInitialStates(config, iface, switchData)
  }
  
  return {
    success: true,
    switchData
  }
}

/**
 * Set up switch properties
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface
 * @param {Object} ifaceDesc - Interface description object
 * @param {Object} switchData - Switch data object to populate
 */
function setupSwitchProperties(config, iface, ifaceDesc, switchData) {
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

  // Create output switches
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

  // Create PWM sliders
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

/**
 * Set up tracking paths for switch
 * @param {Object} config - Node configuration
 * @param {Array<string>} pathsToTrack - Array to add paths to
 */
function setupSwitchPathsToTrack(config, pathsToTrack) {
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

/**
 * Apply saved switch states
 * @param {Object} savedData - Saved device data
 * @param {Object} iface - Device interface
 * @param {Object} switchData - Switch data object
 * @param {Object} config - Node configuration
 * @returns {boolean} True if any state was applied
 */
function applySwitchSavedStates(savedData, iface, switchData, config) {
  if (!savedData || !savedData.switches) return false

  const switchStates = savedData.switches
  let appliedAny = false

  // Apply output states
  switchData.outputKeys.forEach((key, idx) => {
    const outputNum = idx + 1
    const initialSetting = config.switch_output_initial_states && config.switch_output_initial_states[outputNum]
    if (!initialSetting || initialSetting === 'previous') {
      if (switchStates[key] !== undefined) {
        iface[key] = switchStates[key]
        debug(`Applied saved state for output ${key}: ${switchStates[key]}`)
        if (typeof iface.emit === 'function') {
          iface.emit(key, switchStates[key])
        }
        appliedAny = true
      }
    }
  })

  // Apply PWM states
  switchData.pwmKeys.forEach((key, idx) => {
    const pwmNum = idx + 1
    const initialSetting = config.switch_pwm_initial_states && config.switch_pwm_initial_states[pwmNum]
    if (!initialSetting || initialSetting.type === 'previous') {
      if (switchStates[key] !== undefined) {
        iface[key] = switchStates[key]
        debug(`Applied saved state for PWM ${key}: ${switchStates[key]}`)
        if (typeof iface.emit === 'function') {
          iface.emit(key, switchStates[key])
        }
        appliedAny = true
      }
    }
  })

  // Apply custom names and groups for outputs
  for (let i = 1; i <= Number(config.switch_nrofoutput ?? 0); i++) {
    const customNameKey = `SwitchableOutput/output_${i}/Settings/CustomName`
    const groupKey = `SwitchableOutput/output_${i}/Settings/Group`

    if (switchStates[customNameKey] !== undefined) {
      iface[customNameKey] = switchStates[customNameKey]
      debug(`Applied saved CustomName for output ${i}: ${switchStates[customNameKey]}`)
      if (typeof iface.emit === 'function') {
        iface.emit(customNameKey, switchStates[customNameKey])
      }
      appliedAny = true
    }

    if (switchStates[groupKey] !== undefined) {
      iface[groupKey] = switchStates[groupKey]
      debug(`Applied saved Group for output ${i}: ${switchStates[groupKey]}`)
      if (typeof iface.emit === 'function') {
        iface.emit(groupKey, switchStates[groupKey])
      }
      appliedAny = true
    }
  }

  // Apply custom names and groups for PWMs
  for (let i = 1; i <= Number(config.switch_nrofpwm ?? 0); i++) {
    const customNameKey = `SwitchableOutput/pwm_${i}/Settings/CustomName`
    const groupKey = `SwitchableOutput/pwm_${i}/Settings/Group`

    if (switchStates[customNameKey] !== undefined) {
      iface[customNameKey] = switchStates[customNameKey]
      debug(`Applied saved CustomName for PWM ${i}: ${switchStates[customNameKey]}`)
      if (typeof iface.emit === 'function') {
        iface.emit(customNameKey, switchStates[customNameKey])
      }
      appliedAny = true
    }

    if (switchStates[groupKey] !== undefined) {
      iface[groupKey] = switchStates[groupKey]
      debug(`Applied saved Group for PWM ${i}: ${switchStates[groupKey]}`)
      if (typeof iface.emit === 'function') {
        iface.emit(groupKey, switchStates[groupKey])
      }
      appliedAny = true
    }
  }
  
  return appliedAny
}

/**
 * Apply initial states from configuration
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface
 * @param {Object} switchData - Switch data object
 */
function applySwitchConfiguredInitialStates(config, iface, switchData) {
  debug('Applying configured initial states for switch')

  // Apply output states
  if (config.switch_output_initial_states) {
    switchData.outputKeys.forEach((key, idx) => {
      const outputNum = idx + 1
      const initialSetting = config.switch_output_initial_states[outputNum]

      if (initialSetting === 'on') {
        iface[key] = 1
        debug(`Applied configured initial state for ${key}: ON (1)`)
      } else if (initialSetting === 'null') {
        iface[key] = null
        debug(`Applied configured initial state for ${key}: NULL`)
      } else if (initialSetting === 'off') {
        iface[key] = 0
        debug(`Applied configured initial state for ${key}: OFF (0)`)
      }
    })
  }

  // Apply PWM states
  if (config.switch_pwm_initial_states) {
    switchData.pwmKeys.forEach((key, idx) => {
      const pwmNum = idx + 1
      const initialSetting = config.switch_pwm_initial_states[pwmNum]

      if (!initialSetting) return

      if (initialSetting.type === 'off') {
        iface[key] = 0
        debug(`Applied configured initial state for ${key}: OFF (0%)`)
      } else if (initialSetting.type === 'custom') {
        iface[key] = initialSetting.value || 0
        debug(`Applied configured initial state for ${key}: ${initialSetting.value || 0}%`)
      }
    })
  }
}

/**
 * Get status text for node display
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 * @returns {string} Status text
 */
function getStatusText(iface, config) {
  return `Virtual switch: ${config.switch_nrofoutput} switch(es), ${config.switch_nrofpwm} slider(s)`
}

/**
 * Get paths that should be tracked for persistence
 * @param {Object} config - Node configuration
 * @returns {Array<string>} Paths to track
 */
function getPathsToTrack(config) {
  // This is handled in setupSwitchPathsToTrack which directly adds to the pathsToTrack array
  return []
}

/**
 * Apply default values for this device type
 * @param {Object} iface - Device interface
 * @param {Object} config - Node configuration
 */
function applyDefaultValues(iface, config) {
  // Default values for switch are handled in applyConfiguredInitialStates
}

module.exports = {
  getInterfaceDescription,
  getInterface,
  setupDevice,
  getStatusText,
  getPathsToTrack,
  applyDefaultValues
}
