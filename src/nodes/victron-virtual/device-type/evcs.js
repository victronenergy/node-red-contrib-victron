const { buildMinimalMeterProperties, initializeMinimalMeter } = require('./shared/minimal-meter')

// Measurement-only, not a full EVSE simulator - always the minimal meter shape.
const properties = buildMinimalMeterProperties({ includePosition: false })

function initialize (config, ifaceDesc, iface, node) {
  initializeMinimalMeter(config, ifaceDesc, iface, {
    nrOfPhases: config.evcs_nrofphases,
    includePosition: false
  })

  return `Virtual ${iface.NrOfPhases}-phase EV charger`
}

// Registers as com.victronenergy.evcharger on D-Bus - see minimal-meter.js.
function getServiceType () {
  return 'evcharger'
}

function productType () {
  return 'grid'
}

module.exports = { properties, initialize, getServiceType, productType, label: 'EV charger' }
