const properties = {
  'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', immediate: true },
  'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', immediate: true },
  'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', immediate: true },
  'Settings/MonitorMode': { type: 'i', value: 1 }
}

function initialize (config, ifaceDesc, iface, node) {
  if (config.default_values) {
    iface['Dc/0/Current'] = 0
    iface['Dc/0/Power'] = 0
    iface['Dc/0/Voltage'] = 0
  }
  return 'Virtual DC load'
}

module.exports = { properties, initialize, label: 'DC Load' }
