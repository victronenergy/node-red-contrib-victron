const properties = {
  Altitude: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm' : '' },
  Fix: { type: 'i' },
  NrOfSatellites: { type: 'i' },
  'Position/Latitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: 300 },
  'Position/Longitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: 300 },
  Speed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '' },
  Course: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '°' : '' },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

function initialize (config, ifaceDesc, iface, node) {
}

module.exports = { properties, initialize, label: 'GPS' }
