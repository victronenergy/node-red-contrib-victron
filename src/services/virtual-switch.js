/**
 * Shared backend logic for virtual switch functionality.
 * Used by both victron-virtual.js (legacy switch support) and victron-virtual-switch.js (dedicated node).
 *
 * This ensures:
 * - Single source of truth for switch logic
 * - Identical D-Bus output from both nodes
 * - Easier testing and maintenance
 */

const {
  SWITCH_TYPE_MAP,
  SWITCH_TYPE_NAMES,
  SWITCH_TYPE_BITMASK_NAMES,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL
} = require('../nodes/victron-virtual-constants')

const { hsbToRgb } = require('./color-utils')

/**
 * Creates D-Bus interface properties for a virtual switch based on configuration.
 *
 * @param {Object} config - Node configuration object containing switch settings
 * @param {Object} ifaceDesc - D-Bus interface description to populate with property definitions
 * @param {Object} iface - D-Bus interface object to populate with initial values
 * @returns {void} - Modifies ifaceDesc and iface in place
 */
function createSwitchProperties (config, ifaceDesc, iface) {
  const baseProperties = [
    { name: 'State', type: 'i', format: (v) => ({ 0: 'Off', 1: 'On' }[v] || 'unknown'), persist: true, immediate: true },
    { name: 'Status', type: 'i', format: (v) => v != null ? v : '', immediate: true },
    { name: 'Name', type: 's', persist: true },

    // we need value to be '' for Group and CustomName, compare logic below where we set iface[switchableOutputPropertyKey]
    { name: 'Settings/Group', type: 's', value: '', persist: true },
    { name: 'Settings/CustomName', type: 's', value: '', persist: true },

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

  // TODO:: without having CustomName as property, the custom name won't show in dbus-spy, this also
  // seems to conflict with SwitchableOutoutput/output_x/Settings/CustomName
  ifaceDesc.properties.CustomName = {
    type: 's',
    persist: true
  }

  // Add base properties for all switch types
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
  iface[customNameKey] = config.switch_1_customname || ''

  const groupKey = 'SwitchableOutput/output_1/Settings/Group'
  iface[groupKey] = config.switch_1_group || ''

  // Type-specific properties
  if (switchType === 2) {
    // DIMMABLE switch
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
  }

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
}

/**
 * Generates a human-readable status text for the switch node based on configuration.
 *
 * @param {Object} config - Node configuration object
 * @returns {string} - Status text (e.g., "Toggle switch", "Dimmable switch", "RGB control")
 */
function getSwitchStatusText (config) {
  const switchType = Number(config.switch_1_type ?? 1)

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

  return `${typeLabel} switch`
}

/**
 * Handles switch-specific output message generation when D-Bus properties change.
 * This function is called from the emitCallback when ItemsChanged signals are received.
 *
 * @param {Object} config - Node configuration object
 * @param {Object} node - Node-RED node instance
 * @param {string} propName - D-Bus property name that changed (e.g., "SwitchableOutput/output_1/State")
 * @param {*} propValue - New value of the property
 * @returns {void} - Sends output messages via node.send() if values changed
 */
function handleSwitchOutputs (config, node, propName, propValue) {
  // Only process if this is a switch with multiple outputs
  if (config.outputs <= 1) {
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
            topic: `${node.name || 'Virtual switch'}/${topicSuffix}`,
            source_path: '/SwitchableOutput/output_1/Dimming'
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
            topic: `${node.name || 'Virtual switch'}/state`,
            source_path: '/SwitchableOutput/output_1/State'
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
          topic: `${node.name || 'Virtual switch'}/${topicLabel.toLowerCase()}`,
          source_path: '/SwitchableOutput/output_1/Dimming'
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
          topic: `${node.name || 'Virtual switch'}/${topicLabel.toLowerCase()}`,
          source_path: '/SwitchableOutput/output_1/LightControls',
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

module.exports = {
  createSwitchProperties,
  getSwitchStatusText,
  handleSwitchOutputs
}
