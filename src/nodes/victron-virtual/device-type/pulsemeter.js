const properties = {
  Count: { type: 'i', format: (v) => v != null ? String(v) : '', persist: true, immediate: true },
  Aggregate: { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'm³' : '', persist: true, immediate: true }
}

function onPropertyChanged (propName, propValue, iface, config) {
  if (config.auto_aggregate && propName === 'Count' && propValue != null) {
    const multiplier = Number(config.pulsemeter_multiplier)
    if (!isNaN(multiplier) && multiplier > 0) {
      const aggregate = propValue * multiplier
      return {
        setValues: { Aggregate: aggregate },
        outputIndex: 1,
        msg: { payload: aggregate, topic: '/Aggregate', source_path: '/Aggregate' }
      }
    }
  }

  if (propName === 'Aggregate' && propValue != null) {
    return {
      outputIndex: 1,
      msg: { payload: propValue, topic: '/Aggregate', source_path: '/Aggregate' }
    }
  }
}

function initialize (config, ifaceDesc, iface, node) {
  return 'Virtual pulse meter'
}

module.exports = { properties, initialize, onPropertyChanged, label: 'Pulse meter' }
