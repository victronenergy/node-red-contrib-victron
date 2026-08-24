const { accumulateDelta } = require('../energy-utils')
const { enableS2Support } = require('../s2-support')
const { buildMinimalMeterProperties, initializeMinimalMeter } = require('./shared/minimal-meter')

// Presents as a plain generic energy meter by default (see minimal-meter.js). Enabling S2
// support is the only thing that adds extra paths (Position/PhaseSetting plus the S2 paths
// themselves), promoting it to its own full AC load device.
function isFullDevice (config) {
  return !!config.enable_s2support
}

function properties (config) {
  const isFull = isFullDevice(config)
  return buildMinimalMeterProperties({
    includePosition: isFull,
    isGenericEnergyMeter: !isFull
  })
}

function getServiceType () {
  return 'acload'
}

// The D-Bus service stays com.victronenergy.acload (see getServiceType above), but the
// ProductId/ProductName dbus-victron-virtual reports on it should still reflect a grid meter
// when presenting as a plain generic energy meter.
function productType (config) {
  return isFullDevice(config) ? 'acload' : 'grid'
}

// For a single-phase acload, the physical phase it's wired to is configurable (acload_phasesetting)
// instead of always being L1. Multi-phase configs always start at L1.
function resolvePhase (config, i) {
  return Number(config.acload_nrofphases ?? 1) === 1 ? Number(config.acload_phasesetting ?? 1) : i
}

function initialize (config, ifaceDesc, iface, node) {
  const isFull = isFullDevice(config)

  initializeMinimalMeter(config, ifaceDesc, iface, {
    nrOfPhases: config.acload_nrofphases,
    includePosition: isFull,
    position: config.acload_position,
    phaseSetting: config.acload_phasesetting
  })

  if (!isFull) {
    return `Virtual ${iface.NrOfPhases}-phase AC load (generic energy meter)`
  }

  enableS2Support({
    config,
    ifaceDesc,
    iface,
    node,
    deviceLabel: 'acload'
  })

  return `Virtual ${iface.NrOfPhases}-phase AC load`
}

function onPropertiesChanged ({ changes, instance, config }) {
  if (!config.acload_auto_energy) return changes

  const now = Date.now()
  const nrOfPhases = Number(config.acload_nrofphases ?? 1)
  let anyPhaseUpdated = false
  let phaseTotal = 0

  for (let i = 1; i <= nrOfPhases; i++) {
    const phase = resolvePhase(config, i)
    const powerKey = `Ac/L${phase}/Power`
    const energyKey = `Ac/L${phase}/Energy/Forward`
    const tsKey = `_lastL${phase}PowerTimestamp`
    if (powerKey in changes) {
      accumulateDelta({ changes, instance, energyKey, oldPower: instance[powerKey], lastTs: instance[tsKey], now })
      instance[tsKey] = now
      anyPhaseUpdated = true
    }
    phaseTotal += energyKey in changes ? changes[energyKey] : (instance[energyKey] || 0)
  }

  if (anyPhaseUpdated && !('Ac/Energy/Forward' in changes)) {
    changes['Ac/Energy/Forward'] = phaseTotal
  }

  if ('Ac/Power' in changes) {
    if (!anyPhaseUpdated) {
      accumulateDelta({ changes, instance, energyKey: 'Ac/Energy/Forward', oldPower: instance['Ac/Power'], lastTs: instance._lastPowerTimestamp, now })
    }
    // Always update; prevents stale-delta spike when switching from per-phase to total-power reporting.
    instance._lastPowerTimestamp = now
  }

  return changes
}

module.exports = { properties, getServiceType, productType, initialize, onPropertiesChanged, label: 'AC Load', supportsS2: true }
