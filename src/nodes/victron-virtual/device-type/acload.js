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
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
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

function initialize (config, ifaceDesc, iface, node) {
  iface.NrOfPhases = Number(config.acload_nrofphases ?? 1)
  for (let i = 1; i <= iface.NrOfPhases; i++) {
    const phase = `L${i}`
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
    const powerKey = `Ac/L${i}/Power`
    const energyKey = `Ac/L${i}/Energy/Forward`
    const tsKey = `_lastL${i}PowerTimestamp`
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
