const { createSwitchProperties, getSwitchStatusText } = require('../../../services/virtual-switch')

const properties = {
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  State: { type: 'i', value: 0x100 }
}

function initialize (config, ifaceDesc, iface, node) {
  createSwitchProperties(config, ifaceDesc, iface)
  return getSwitchStatusText(config)
}

module.exports = { properties, initialize, label: 'Switch (deprecated)' }
