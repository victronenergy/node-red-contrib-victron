const properties = {
  CellTemperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 300 },
  ExternalTemperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 300 },
  Irradiance: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'W/m2' : '', persist: 300 },
  WindSpeed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '', persist: 300 },
  WindDirection: { type: 'i', persist: 300 }
}

function initialize (config, ifaceDesc, iface, node) {
  if (config.default_values) {
    iface.Irradiance = 0
    iface.WindSpeed = 0
  }
}

module.exports = { properties, initialize, label: 'Meteo' }
