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

  const properties = [
    { name: 'Value', type: 'd', persist: true },
    { name: 'Status', type: 'i', value: 0, persist: true, format: (v) => INDICATOR_STATUS_NAMES[v] ?? String(v) },
    { name: 'Name', type: 's', value: config.customname || '' },
    { name: 'Settings/CustomName', type: 's', value: config.customname || '', persist: false },
    { name: 'Settings/Group', type: 's', value: config.group || '', persist: false },
    {
      name: 'Settings/ShowUIInput',
      type: 'i',
      value: config.show_ui_input ?? 1,
      persist: true,
      format: (v) => {
        if (v === 0) return 'Hidden'
        const parts = []
        if (v & 0b001) parts.push('All UIs')
        if (v & 0b010) parts.push('GX device')
        if (v & 0b100) parts.push('VRM')
        return parts.length > 0 ? parts.join(' + ') : 'Hidden'
      }
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

  if (isDiscrete && config.labels) {
    const labels = config.labels.split(',').map(l => l.trim())
    properties.push({ name: 'Settings/Labels', type: 'as', value: labels, format: (v) => Array.isArray(v) ? v.join(', ') : String(v) })
  }

  if (config.decimals !== undefined && config.decimals !== '') {
    properties.push({ name: 'Settings/Decimals', type: 'i', value: Number(config.decimals), format: (v) => `${v} dp` })
  }

  if (config.primary_label !== undefined && config.primary_label !== '') {
    properties.push({ name: 'Settings/PrimaryLabel', type: 's', value: config.primary_label })
  }

  properties.forEach(({ name, type, value, format, persist, immediate }) => {
    const key = `${INDICATOR_INPUT_KEY}/${name}`
    ifaceDesc.properties[key] = { type, format, persist, immediate }
    if (value !== undefined) {
      iface[key] = value
    } else {
      iface[key] = type === 's' ? '' : type === 'as' ? [] : null
    }
  })

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

  const valueText = value != null ? `${value}${unit}` : '-'
  node.status({ fill: 'green', shape: 'dot', text: `${valueText} (${deviceInstance})` })
}

module.exports = { createIndicatorProperties, updateIndicatorStatus, INDICATOR_TYPE_NAMES, INDICATOR_INPUT_KEY }
