const debug = require('debug')('virtual-device:pulsemeter')

const properties = {
  Count: { type: 'i', format: (v) => v != null ? String(v) : '', persist: true, immediate: true },
  Aggregate: { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'm³' : '', persist: true, immediate: true }
}

function onPropertiesChanged ({ changes, instance, config }) {
  debug('Properties changed, changes:', changes, 'instance:', instance, 'config:', config)

  if (config.auto_aggregate && changes.Count != null) {
    const multiplier = Number(config.pulsemeter_multiplier)
    if (!isNaN(multiplier) && multiplier > 0) {
      const aggregate = changes.Count * multiplier
      debug('Auto-aggregating Count:', changes.Count, 'with multiplier:', multiplier, 'to get Aggregate:', aggregate)
      changes.Aggregate = aggregate
    } else {
      debug('Invalid pulsemeter_multiplier:', config.pulsemeter_multiplier, 'must be a positive number. Skipping aggregate calculation.')
    }
  } else {
    debug('Auto-aggregation is disabled or Count is not changed, skipping aggregate calculation')
  }

  return changes
}

function initialize (config, ifaceDesc, iface, node) {
  return 'Virtual pulse meter'
}

module.exports = { properties, initialize, onPropertiesChanged, label: 'Pulse meter' }
