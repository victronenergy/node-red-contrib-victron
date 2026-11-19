const { accumulateDelta } = require('../../energy-utils')

// phases are the physical phase numbers the meter reports on (a single-phase meter can be wired
// to L2 or L3). A flow can report phase powers, Ac/Power or both, and switch between them. Each
// interval since the previous power update is integrated once, with the source that reported
// during it; when a message has both, the phase powers are used.
function accumulateMeterEnergy ({ changes, instance, phases, now }) {
  const phaseKeys = phases.map(phase => ({ power: `Ac/L${phase}/Power`, energy: `Ac/L${phase}/Energy/Forward` }))
  const phaseUpdate = phaseKeys.some(({ power }) => power in changes)
  if (!phaseUpdate && !('Ac/Power' in changes)) return

  const lastTs = instance._lastPowerTimestamp
  if (instance._powerSource === 'phases') {
    // Add to the total instead of summing the phases, so a total counted from Ac/Power is kept
    let added = 0
    for (const { power, energy } of phaseKeys) {
      accumulateDelta({ changes, instance, energyKey: energy, oldPower: instance[power], lastTs, now })
      if (energy in changes) added += changes[energy] - (instance[energy] || 0)
    }
    if (added !== 0 && !('Ac/Energy/Forward' in changes)) {
      changes['Ac/Energy/Forward'] = (instance['Ac/Energy/Forward'] || 0) + added
    }
  } else if (instance._powerSource === 'total') {
    accumulateDelta({ changes, instance, energyKey: 'Ac/Energy/Forward', oldPower: instance['Ac/Power'], lastTs, now })
  }

  instance._lastPowerTimestamp = now
  instance._powerSource = phaseUpdate ? 'phases' : 'total'
}

module.exports = { accumulateMeterEnergy }
