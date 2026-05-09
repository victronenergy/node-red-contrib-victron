const INDICATOR_TYPE_NAMES = {
  0: 'Discrete',
  1: 'Value',
  2: 'Value with range',
  3: 'Temperature'
}

const INDICATOR_INPUT_KEY = 'GenericInput/0'

/**
 * Creates D-Bus interface properties for a virtual indicator based on configuration.
 *
 * @param {Object} config - Node configuration object containing indicator settings
 * @param {Object} ifaceDesc - D-Bus interface description to populate with property definitions
 * @param {Object} iface - D-Bus interface object to populate with initial values
 * @returns {void} - Modifies ifaceDesc and iface in place
 */
function createIndicatorProperties (config, ifaceDesc, iface) {
  const indicatorType = Number(config.indicator_type ?? 1)
  const hasRange = indicatorType === 2 || indicatorType === 3
  const isDiscrete = indicatorType === 0

  const INDICATOR_STATUS_NAMES = { 0: 'Ok', 3: 'Not connected' }

  const discreteLabels = (isDiscrete && config.labels)
    ? config.labels.split(',').map(l => l.trim())
    : null

  const rangeMin = (hasRange && config.range_min !== undefined && config.range_min !== '') ? Number(config.range_min) : undefined
  const rangeMax = (hasRange && config.range_max !== undefined && config.range_max !== '') ? Number(config.range_max) : undefined

  const properties = [
    {
      name: 'Value',
      type: 'd',
      persist: true,
      ...(discreteLabels ? { min: 0, max: discreteLabels.length - 1 } : {}),
      ...(rangeMin !== undefined ? { min: rangeMin } : {}),
      ...(rangeMax !== undefined ? { max: rangeMax } : {})
    },
    { name: 'Status', type: 'i', value: 0, persist: true, format: (v) => INDICATOR_STATUS_NAMES[v] ?? String(v) },
    { name: 'Name', type: 's', value: INDICATOR_TYPE_NAMES[indicatorType] || 'Indicator', readonly: true },
    { name: 'Settings/CustomName', type: 's', value: config.customname || '', persist: false },
    { name: 'Settings/Group', type: 's', value: config.group || '', persist: false },
    {
      name: 'Settings/ShowUIInput',
      type: 'i',
      value: Number(config.show_ui_input ?? 1),
      persist: false,
      format: (v) => ({ 0: 'Hidden', 1: 'All UIs', 2: 'GX device', 4: 'VRM' }[v] ?? String(v))
    },
    { name: 'Settings/Type', type: 'i', value: indicatorType, persist: false, format: (v) => INDICATOR_TYPE_NAMES[v] || 'unknown' },
    {
      name: 'Settings/ValidTypes',
      type: 'i',
      value: 1 << indicatorType,
      format: (v) => {
        if (v == null || v === 0) return 'None'
        return Object.entries(INDICATOR_TYPE_NAMES)
          .filter(([bit]) => v & (1 << Number(bit)))
          .map(([, name]) => name)
          .join(', ') || 'None'
      }
    }
  ]

  if (config.unit !== undefined && config.unit !== '') {
    properties.push({ name: 'Settings/Unit', type: 's', value: config.unit })
  }

  if (hasRange) {
    if (config.range_min !== undefined) {
      properties.push({ name: 'Settings/RangeMin', type: 'd', value: Number(config.range_min) })
    }
    if (config.range_max !== undefined) {
      properties.push({ name: 'Settings/RangeMax', type: 'd', value: Number(config.range_max) })
    }
  }

  if (discreteLabels) {
    properties.push({ name: 'Settings/Labels', type: 'as', value: discreteLabels, format: (v) => Array.isArray(v) ? v.join(', ') : String(v) })
  }

  if (config.decimals !== undefined && config.decimals !== '') {
    properties.push({ name: 'Settings/Decimals', type: 'i', value: Number(config.decimals), format: (v) => `${v} dp` })
  }

  if (config.primary_label !== undefined && config.primary_label !== '') {
    properties.push({ name: 'Settings/PrimaryLabel', type: 's', value: config.primary_label })
  }

  properties.forEach(({ name, type, value, format, persist, immediate, min, max, readonly }) => {
    const key = `${INDICATOR_INPUT_KEY}/${name}`
    ifaceDesc.properties[key] = { type, format, persist, immediate, min, max, readonly }
    if (value !== undefined) {
      iface[key] = value
    } else {
      iface[key] = type === 's' ? '' : type === 'as' ? [] : null
    }
  })

  ifaceDesc.properties.State = { type: 'i' }
  iface.State = 0x100
  ifaceDesc.properties.CustomName = { type: 's', persist: true }
  ifaceDesc.properties.DeviceInstance = { type: 'i' }
  ifaceDesc.properties.Serial = { type: 's', persist: true }
}

/**
 * Updates node.status to reflect the current indicator value.
 * Called after initial connect and triggered again after inject feedback times out.
 *
 * @param {Object} config - Node configuration object
 * @param {Object} node - Node-RED node instance (must have node.iface)
 */
function updateIndicatorStatus (config, node) {
  const iface = node.iface
  if (!iface) return

  const deviceInstance = iface.DeviceInstance
  const value = iface[`${INDICATOR_INPUT_KEY}/Value`]
  const unit = config.unit || ''
  const indicatorType = Number(config.indicator_type ?? 1)
  const typeName = INDICATOR_TYPE_NAMES[indicatorType] || 'Value'
  const isDiscrete = indicatorType === 0

  if (value == null) {
    node.status({ fill: 'grey', shape: 'ring', text: `${typeName} - no value (${deviceInstance})` })
  } else if (isDiscrete && config.labels) {
    const labels = config.labels.split(',').map(l => l.trim())
    const label = labels[value] ?? String(value)
    node.status({ fill: 'green', shape: 'dot', text: `${value}: ${label} (${deviceInstance})` })
  } else {
    node.status({ fill: 'green', shape: 'dot', text: `${value}${unit} (${deviceInstance})` })
  }
}

module.exports = { createIndicatorProperties, updateIndicatorStatus, INDICATOR_TYPE_NAMES, INDICATOR_INPUT_KEY }
