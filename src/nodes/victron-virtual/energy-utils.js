const debug = require('debug')('victron-virtual:energy')

const WATT_MILLISECONDS_PER_KWH = 3_600_000_000

function accumulateDelta ({ changes, instance, energyKey, oldPower, lastTs, now }) {
  debug('accumulateDelta', { changes, instance, energyKey, oldPower, lastTs, now })
  if (lastTs != null && oldPower != null && !(energyKey in changes)) {
    const deltaKwh = Math.max(0, oldPower) * (now - lastTs) / WATT_MILLISECONDS_PER_KWH
    if (deltaKwh > 0) {
      changes[energyKey] = (instance[energyKey] || 0) + deltaKwh
      debug('accumulateDelta', { deltaKwh, newEnergy: changes[energyKey] })
    }
  }
}

module.exports = { WATT_MILLISECONDS_PER_KWH, accumulateDelta }
