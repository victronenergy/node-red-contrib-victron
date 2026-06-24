const hasEvcsInstance = (config) => config != null && config.ev_evcs_device_instance != null && config.ev_evcs_device_instance !== ''

const formatTimestamp = (v) => {
  if (v == null) return ''
  const date = new Date(v * 1000)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

const properties = (config) => ({
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'W' : '' },
  Soc: { type: 'd', format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: true },
  TargetSoc: { type: 'd', format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: true },
  ChargingState: {
    type: 'i',
    format: (v) => ({
      0: 'Not charging',
      1: 'Low power mode',
      3: 'Charging',
      244: 'Sustain',
      245: 'Wake up',
      250: 'Blocked',
      255: 'Unavailable',
      256: 'Discharging',
      259: 'Scheduled charging'
    }[v] || 'unknown')
  },
  BatteryCapacity: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'kWh' : '', persist: true },
  VIN: { type: 's', readonly: true },
  Odometer: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'km' : '', persist: true },
  RangeToGo: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'km' : '' },
  'Position/Latitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '\u00b0' : '' },
  'Position/Longitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '\u00b0' : '' },
  AtSite: {
    type: 'i',
    format: (v) => ({
      0: 'No',
      1: 'Yes'
    }[v] || 'unknown'),
    value: 0,
    persist: 300
  },
  'LastUpdated/Location': { type: 'i', format: formatTimestamp, persist: 300 },
  'LastUpdated/Charging': { type: 'i', format: formatTimestamp, persist: 300 },
  'LastUpdated/EvContact': { type: 'i', format: formatTimestamp, persist: 300 },
  'Alarms/StarterBatteryLow': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  'Mgmt/Connection': hasEvcsInstance(config)
    ? { type: 'i' }
    : { type: 's', value: 'Node-RED' }
})

function initialize (config, _ifaceDesc, iface, _node) {
  if (config.ev_vin) {
    iface.VIN = config.ev_vin
  }
  if (config.ev_battery_capacity != null && config.ev_battery_capacity !== '' && !isNaN(Number(config.ev_battery_capacity))) {
    iface.BatteryCapacity = Number(config.ev_battery_capacity)
  }
  return 'Virtual EV'
}

function onPropertiesChanged ({ changes, instance, config }) {
  const now = Math.floor(Date.now() / 1000)

  if (!changes['LastUpdated/EvContact']) {
    changes['LastUpdated/EvContact'] = now
  }

  const positionFields = ['Position/Latitude', 'Position/Longitude', 'AtSite']
  if (positionFields.some(f => f in changes && !changes['LastUpdated/Location'])) {
    changes['LastUpdated/Location'] = now
  }

  if ('ChargingState' in changes && changes.ChargingState !== instance.ChargingState && !changes['LastUpdated/Charging']) {
    changes['LastUpdated/Charging'] = now
  }

  if ('AtSite' in changes && hasEvcsInstance(config)) {
    changes['Mgmt/Connection'] = changes.AtSite === 1 ? config.ev_evcs_device_instance : null
  }

  return changes
}

module.exports = { properties, initialize, onPropertiesChanged, label: 'Electric Vehicle' }
