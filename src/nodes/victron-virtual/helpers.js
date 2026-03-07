/**
 * Creates a setPresence function for a virtual device node.
 * @param {object} node - The Node-RED node (must have bus, serviceName, presenceConnected, status)
 * @param {string} text - Device display label
 * @param {object} iface - Device interface (must have DeviceInstance)
 * @returns {Function} setPresence(connected, onDone)
 */
function makeSetPresence (node, text, iface) {
  return function setPresence (connected, onDone) {
    const statusText = `${text} (${iface.DeviceInstance})`
    if (connected && !node.presenceConnected) {
      node.bus.requestName(node.serviceName, 0x4, (err, retCode) => {
        if (!err && (retCode === 1 || retCode === 3)) {
          node.presenceConnected = true
          node.status({ fill: 'green', shape: 'dot', text: statusText })
        }
        onDone()
      })
    } else if (!connected && node.presenceConnected) {
      node.bus.releaseName(node.serviceName, (err) => {
        if (!err) {
          node.presenceConnected = false
          node.status({ fill: 'grey', shape: 'ring', text: `${statusText} - offline` })
        }
        onDone()
      })
    } else {
      onDone()
    }
  }
}

module.exports = { makeSetPresence }
