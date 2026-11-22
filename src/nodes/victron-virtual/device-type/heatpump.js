const { enableS2Support } = require('../s2-support')
const { buildMinimalMeterProperties, initializeMinimalMeter } = require('./shared/minimal-meter')
const { accumulateMeterEnergy, groupMeterInputs, meterPhases, setMeterPresence } = require('./shared/meter-energy')

// Presents as a plain generic energy meter by default (see minimal-meter.js). Position/PhaseSetting
// are configurable regardless of S2 support; enabling S2 support additionally adds the S2 paths
// themselves, promoting it to its own full heat pump device.
function isFullDevice (config) {
  return !!config.enable_s2support
}

function properties (config) {
  const isFull = isFullDevice(config)
  return buildMinimalMeterProperties({
    includePosition: true,
    isGenericEnergyMeter: !isFull
  })
}

function getServiceType () {
  return 'heatpump'
}

// The D-Bus service stays com.victronenergy.heatpump (see getServiceType above), but the
// ProductId/ProductName dbus-victron-virtual reports on it should still reflect a grid meter
// when presenting as a plain generic energy meter.
function productType (config) {
  return isFullDevice(config) ? 'heatpump' : 'grid'
}

function initialize (config, ifaceDesc, iface, node) {
  const isFull = isFullDevice(config)

  initializeMinimalMeter(config, ifaceDesc, iface, {
    nrOfPhases: config.heatpump_nrofphases,
    includePosition: true,
    position: config.heatpump_position,
    phaseSetting: config.heatpump_phasesetting
  })
  if (config.heatpump_auto_energy) groupMeterInputs(ifaceDesc)

  if (!isFull) {
    return `Virtual ${iface.NrOfPhases}-phase heat pump (generic energy meter)`
  }

  enableS2Support({
    config,
    ifaceDesc,
    iface,
    node,
    deviceLabel: 'heatpump'
  })

  return `Virtual ${iface.NrOfPhases}-phase heat pump`
}

function onPropertiesChanged ({ changes, instance, config }) {
  if (config.heatpump_auto_energy) {
    accumulateMeterEnergy({ changes, instance, phases: meterPhases(config.heatpump_nrofphases, config.heatpump_phasesetting), now: Date.now() })
  }
  return changes
}

module.exports = { properties, getServiceType, productType, initialize, onPropertiesChanged, onPresenceChange: setMeterPresence, label: 'Heat pump', supportsS2: true }
