const properties = {
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'W' : '' },
  Soc: { type: 'd', format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: true },
  TargetSoc: { type: 'd', format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: true },
  ChargingState: {
    type: 'i',
    format: (v) => ({
      0: 'Disconnected',
      1: 'Connected',
      2: 'Charging',
      3: 'Charged',
      5: 'Inverting',
      6: 'Error',
      7: 'Unknown'
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
  LastEvContact: {
    type: 'i',
    format: (v) => {
      if (v == null) return ''
      const date = new Date(v * 1000)
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
    },
    persist: 300
  },
  'Alarms/StarterBatteryLow': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

function initialize (config, _ifaceDesc, iface, _node) {
  if (config.ev_vin) {
    iface.VIN = config.ev_vin
  }
  if (config.ev_battery_capacity != null && config.ev_battery_capacity !== '' && !isNaN(Number(config.ev_battery_capacity))) {
    iface.BatteryCapacity = Number(config.ev_battery_capacity)
  }
  return 'Virtual EV'
}

module.exports = { properties, initialize, label: 'Electric Vehicle' }
