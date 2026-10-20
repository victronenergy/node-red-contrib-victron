const { accumulateDelta } = require('../../energy-utils')

// Same calculation as the AC load and heat pump auto energy. phases are the physical phase
// numbers the meter reports on (a single-phase meter can be wired to L2 or L3).
function accumulateMeterEnergy ({ changes, instance, phases, now }) {
  let anyPhaseUpdated = false
  let phaseTotal = 0

  for (const phase of phases) {
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
}

module.exports = { accumulateMeterEnergy }
