const { accumulateDelta } = require('../energy-utils')
const { enableS2Support } = require('../s2-support')
const ENERGY_PERSIST_SECONDS = 60

const properties = {
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'kWh' : '', persist: ENERGY_PERSIST_SECONDS },
  'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'kWh' : '', persist: ENERGY_PERSIST_SECONDS },
  'Ac/L1/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
  'Ac/L1/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'kWh' : '' },
  'Ac/L1/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'kWh' : '' },
  'Ac/L1/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/L1/PowerFactor': { type: 'd', format: (v) => v != null ? v.toFixed(2) : '' },
  'Ac/L1/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'Hz' : '' },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  IsGenericEnergyMeter: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  Position: {
    type: 'i',
    format: (v) => ({
      0: 'AC output',
      1: 'AC input'
    }[v] || 'unknown')
  }
}

const phaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Power', unit: 'W' },
  { name: 'Voltage', unit: 'V' },
  { name: 'Energy/Forward', unit: 'kWh', persist: ENERGY_PERSIST_SECONDS },
  { name: 'Energy/Reverse', unit: 'kWh', persist: ENERGY_PERSIST_SECONDS },
  { name: 'PowerFactor', unit: '' }
]

// acload's S2 resource settings: a simple on/off consumer controlled by hysteresis thresholds
// around a power setpoint. Other resource types (a producer's curtailment limit, storage's
// charge/discharge bounds) would define their own shape and pass it to enableS2Support.
const S2_RESOURCE_PROPERTIES = {
  'S2/0/RmSettings/OffHysteresis': { type: 'i' },
  'S2/0/RmSettings/OnHysteresis': { type: 'i' },
  'S2/0/RmSettings/PowerSetting': { type: 'i' }
}

const S2_RESOURCE_DEFAULTS = {
  'S2/0/RmSettings/OffHysteresis': 30,
  'S2/0/RmSettings/OnHysteresis': 30,
  'S2/0/RmSettings/PowerSetting': 1000
}

// For a single-phase acload, the physical phase it's wired to is configurable (acload_phasesetting)
// instead of always being L1. Multi-phase configs always start at L1.
function resolvePhase (config, i) {
  return Number(config.acload_nrofphases ?? 1) === 1 ? Number(config.acload_phasesetting ?? 1) : i
}

function initialize (config, ifaceDesc, iface, node) {
  iface.Position = Number(config.acload_position ?? 0)
  iface.NrOfPhases = Number(config.acload_nrofphases ?? 1)

  const isSinglePhase = iface.NrOfPhases === 1
  if (isSinglePhase) {
    iface.PhaseSetting = resolvePhase(config, 1)
    ifaceDesc.properties.PhaseSetting = { type: 'i', format: (v) => v != null ? 'L' + v : '' }

    if (iface.PhaseSetting !== 1) {
      // The static properties declare an L1 set by default; drop it so only the phase
      // actually wired up is exposed, instead of leaving a phantom always-null L1 set behind.
      phaseProperties.forEach(({ name }) => {
        const staticKey = `Ac/L1/${name}`
        delete ifaceDesc.properties[staticKey]
        delete iface[staticKey]
      })
    }
  }

  for (let i = 1; i <= iface.NrOfPhases; i++) {
    const phase = `L${resolvePhase(config, i)}`
    phaseProperties.forEach(({ name, unit, persist }) => {
      const key = `Ac/${phase}/${name}`
      const propDef = {
        type: 'd',
        format: (v) => v != null ? v.toFixed(2) + unit : '',
        ...(persist && { persist })
      }
      ifaceDesc.properties[key] = propDef
      iface[key] = 0
    })
  }

  if (config.default_values) {
    iface['Ac/Power'] = 0
    iface['Ac/Energy/Forward'] = 0
    iface['Ac/Energy/Reverse'] = 0
  }

  enableS2Support({
    config,
    ifaceDesc,
    iface,
    node,
    deviceLabel: 'acload',
    resourceProperties: S2_RESOURCE_PROPERTIES,
    resourceDefaults: S2_RESOURCE_DEFAULTS
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

module.exports = { properties, initialize, onPropertiesChanged, label: 'AC Load', supportsS2: true }
