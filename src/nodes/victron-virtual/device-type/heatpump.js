const { accumulateDelta } = require('../energy-utils')
const { enableS2Support } = require('../s2-support')
const { buildMinimalMeterProperties, initializeMinimalMeter } = require('./shared/minimal-meter')

// "Use as grid meter only" reports a minimal measurement set (see minimal-meter.js) for use as
// the system's grid meter, but - unlike acload/generator/evcs - stays registered as
// com.victronenergy.heatpump on D-Bus rather than switching to com.victronenergy.grid.
function properties (config) {
  return buildMinimalMeterProperties({
    includePosition: !config.heatpump_grid_meter_only,
    isGenericEnergyMeter: !!config.heatpump_grid_meter_only
  })
}

function getServiceType () {
  return 'heatpump'
}

// The D-Bus service stays com.victronenergy.heatpump (see getServiceType above), but the
// ProductId/ProductName dbus-victron-virtual reports on it should still reflect a grid meter
// when used as one.
function productType (config) {
  return config.heatpump_grid_meter_only ? 'grid' : 'heatpump'
}

// For a single-phase heat pump, the physical phase it's wired to is configurable
// (heatpump_phasesetting) instead of always being L1. Multi-phase configs always start at L1.
function resolvePhase (config, i) {
  return Number(config.heatpump_nrofphases ?? 1) === 1 ? Number(config.heatpump_phasesetting ?? 1) : i
}

function initialize (config, ifaceDesc, iface, node) {
  const gridMeterOnly = !!config.heatpump_grid_meter_only

  initializeMinimalMeter(config, ifaceDesc, iface, {
    nrOfPhases: config.heatpump_nrofphases,
    includePosition: !gridMeterOnly,
    position: config.heatpump_position,
    phaseSetting: config.heatpump_phasesetting
  })

  if (gridMeterOnly) {
    return `Virtual ${iface.NrOfPhases}-phase heat pump (grid meter mode)`
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
  if (!config.heatpump_auto_energy || config.heatpump_grid_meter_only) return changes

  const now = Date.now()
  const nrOfPhases = Number(config.heatpump_nrofphases ?? 1)
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

module.exports = { properties, getServiceType, productType, initialize, onPropertiesChanged, label: 'Heat pump', supportsS2: true }
