const properties = {
  Altitude: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm' : '' },
  Fix: { type: 'i' },
  NrOfSatellites: { type: 'i' },
  'Position/Latitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: 300 },
  'Position/Longitude': { type: 'd', format: (v) => v != null ? v.toFixed(6) + '°' : '', persist: 300 },
  Speed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '' },
  Course: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '°' : '' },
  UtcTime: { type: 'u', format: (v) => { if (v == null) return ''; const h = Math.floor(v / 3600000); const m = Math.floor((v % 3600000) / 60000); const s = Math.floor((v % 60000) / 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC` } },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

const GPS_DATA_FIELDS = ['Position/Latitude', 'Position/Longitude', 'Speed', 'Course', 'Altitude', 'Fix', 'NrOfSatellites']

function initialize (config, ifaceDesc, iface, node) {
}

function onPropertiesChanged ({ changes }) {
  if (GPS_DATA_FIELDS.some(f => f in changes) && !('UtcTime' in changes)) {
    changes.UtcTime = Date.now() % 86400000
  }
  return changes
}

module.exports = { properties, initialize, onPropertiesChanged, label: 'GPS' }
