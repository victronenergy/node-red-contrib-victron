const debug = require('debug')('victron-virtual:energy')

const WATT_MILLISECONDS_PER_KWH = 3_600_000_000

// in kWh
function energySince (power, lastTs, now) {
  if (lastTs == null || power == null) return 0
  const deltaKwh = Math.max(0, power) * (now - lastTs) / WATT_MILLISECONDS_PER_KWH
  debug('energySince', { power, lastTs, now, deltaKwh })
  return deltaKwh
}

// A single-phase meter reports on the phase it's wired to, multi-phase ones on L1 upwards.
function meterPhases (nrOfPhases, phaseSetting) {
  nrOfPhases = Number(nrOfPhases ?? 1)
  if (nrOfPhases === 1) return [Number(phaseSetting ?? 1)]
  return Array.from({ length: nrOfPhases }, (_, i) => i + 1)
}

// The node input debounces each key on its own. With auto energy, the calculation combines the
// power and energy values of a message, so those paths share a group and a message lands in one call.
function groupMeterInputs (ifaceDesc) {
  for (const [key, property] of Object.entries(ifaceDesc.properties)) {
    if (/^Ac\/(L\d\/)?(Power|Energy\/\w+)$/.test(key)) property.debounceGroup = 'meter'
  }
}

// phases are the physical phase numbers the meter reports on (a single-phase meter can be wired
// to L2 or L3). A flow can report phase powers, Ac/Power or both, and switch between them. Each
// interval since the previous power update is integrated once, with the source of the update
// that started it; when a message has both, the phase powers are used. A meter's own counters are
// only supported in every message with the power (see the help).
function accumulateMeterEnergy ({ changes, instance, phases, now }) {
  const phaseKeys = phases.map(phase => ({ power: `Ac/L${phase}/Power`, energy: `Ac/L${phase}/Energy/Forward` }))
  const phaseUpdate = phaseKeys.some(({ power }) => power in changes)
  if (!phaseUpdate && !('Ac/Power' in changes)) return

  const end = instance._offlineSince ?? now
  const lastTs = instance._lastPowerTimestamp
  // The total grows by each phase's growth instead of being the sum of the phases, so a total
  // counted from Ac/Power is kept. A phase counter the flow sends in every message with the phase
  // power counts by its growth, never negative, so a coarser or reset counter can't lower the total.
  let added = 0
  for (const { power, energy } of phaseKeys) {
    if (energy in changes) {
      if (instance._powerSource !== 'total') added += Math.max(0, changes[energy] - (instance[energy] || 0))
    } else if (instance._powerSource === 'phases') {
      const delta = energySince(instance[power], lastTs, end)
      if (delta > 0) {
        changes[energy] = (instance[energy] || 0) + delta
        added += delta
      }
    }
  }
  if (instance._powerSource === 'total') added += energySince(instance['Ac/Power'], lastTs, end)
  if (added > 0 && !('Ac/Energy/Forward' in changes)) {
    changes['Ac/Energy/Forward'] = (instance['Ac/Energy/Forward'] || 0) + added
  }

  instance._lastPowerTimestamp = end
  instance._powerSource = phaseUpdate ? 'phases' : 'total'
}

// The presence hook of the meter devices: the time offline is cut out of the interval, so an
// offline device counts no energy and the last power counts again from the moment it is back
function setMeterPresence (instance, connected, now = Date.now()) {
  if (!connected) {
    instance._offlineSince ??= now
  } else if (instance._offlineSince != null) {
    if (instance._lastPowerTimestamp != null) instance._lastPowerTimestamp += now - instance._offlineSince
    delete instance._offlineSince
  }
}

module.exports = { accumulateMeterEnergy, groupMeterInputs, meterPhases, setMeterPresence }
