// Maps D-Bus AC power property names to S2 CommodityQuantity values for power
// measurement reporting. Generic for any AC-phased device exposing
// Ac/Power / Ac/L{n}/Power paths - not specific to any one device-type module.
const MEASUREMENT_TYPE_TO_PROPS = {
  '3_PHASE_SYMMETRIC': { 'Ac/Power': 'ELECTRIC.POWER.3_PHASE_SYMMETRIC' },
  L1_L2_L3: {
    'Ac/L1/Power': 'ELECTRIC.POWER.L1',
    'Ac/L2/Power': 'ELECTRIC.POWER.L2',
    'Ac/L3/Power': 'ELECTRIC.POWER.L3'
  },
  L1: { 'Ac/L1/Power': 'ELECTRIC.POWER.L1' },
  L2: { 'Ac/L2/Power': 'ELECTRIC.POWER.L2' },
  L3: { 'Ac/L3/Power': 'ELECTRIC.POWER.L3' }
}

// Generic S2 transport-state properties, present for any S2-capable device regardless of
// whether it's a consumer, producer, or storage resource.
const TRANSPORT_PROPERTIES = {
  'S2/0/Active': { type: 'i' },
  'S2/0/Rm': { type: 's', format: (v) => v != null ? v : '' }
}

const TRANSPORT_DEFAULTS = {
  'S2/0/Active': 0,
  'S2/0/Rm': ''
}

/**
 * Wires up S2 protocol support onto a D-Bus AC-power-measuring virtual device.
 * Call unconditionally from a device-type module's initialize(config, ifaceDesc, iface, node) -
 * it is a no-op unless config.enable_s2support is truthy.
 *
 * The S2 transport (Connect/Disconnect/Message/KeepAlive, power measurement) is generic across
 * consumer/producer/storage resources. Resource-specific settings (e.g. an on/off load's
 * hysteresis thresholds, a PV inverter's curtailment limit, a battery's charge/discharge bounds)
 * are NOT defined here - pass them via resourceProperties/resourceDefaults so each device-type
 * module owns its own S2 resource-settings shape while sharing this transport.
 *
 * @param {object} params
 * @param {object} params.config - Node-RED node config
 * @param {object} params.ifaceDesc - D-Bus interface description being built (has .properties)
 * @param {object} params.iface - D-Bus interface implementation object (property values)
 * @param {object} params.node - Node-RED runtime node (needs .send()/.setValuesLocally())
 * @param {string} [params.deviceLabel] - Used only in the startup console.warn message
 * @param {object} [params.resourceProperties] - ifaceDesc property definitions for this
 *   device's S2 resource settings, merged in alongside the generic S2/0/Active and S2/0/Rm
 *   transport properties.
 * @param {object} [params.resourceDefaults] - initial iface values for resourceProperties' keys.
 */
function enableS2Support ({ config, ifaceDesc, iface, node, deviceLabel, resourceProperties = {}, resourceDefaults = {} }) {
  if (!config.enable_s2support) return

  console.warn(`S2 support for ${deviceLabel || 'this'} virtual device is experimental.`)

  Object.entries({ ...TRANSPORT_PROPERTIES, ...resourceProperties }).forEach(([key, desc]) => {
    ifaceDesc.properties[key] = desc
    iface[key] = key in resourceDefaults ? resourceDefaults[key] : TRANSPORT_DEFAULTS[key]
  })

  ifaceDesc.__enableS2 = true
  // Maps D-Bus property names to S2 CommodityQuantity values for power measurement reporting
  const measurementType = config.s2_measurement_type || '3_PHASE_SYMMETRIC'
  ifaceDesc.__s2PowerMeasurementProps = MEASUREMENT_TYPE_TO_PROPS[measurementType]

  ifaceDesc.__s2Handlers = {
    Connect: function (cemId, timeout) {
      node._s2PowerMeasurementActive = false
      node._s2PowerMeasurementCemId = null
      node.setValuesLocally({ 'S2/0/Active': 1, 'S2/0/Rm': 'CEM: ' + cemId })
      console.log('Connect received for CEM ID:', cemId, 'timeout', timeout)
      node.send([
        null,
        {
          payload: {
            command: 'Connect',
            cemId,
            keepAliveInterval: timeout
          }
        }
      ])
    },
    Disconnect: function (cemId) {
      node._s2PowerMeasurementActive = false
      node._s2PowerMeasurementCemId = null
      node.setValuesLocally({ 'S2/0/Active': 0, 'S2/0/Rm': '' })
      node.send([
        null,
        {
          payload: {
            command: 'Disconnect',
            cemId
          }
        }
      ])
    },
    Message: function (cemId, message) {
      node.send([
        null,
        {
          payload: {
            command: 'Message',
            cemId,
            message
          }
        }
      ])
    },
    KeepAlive: function (cemId) {
      console.log('KeepAlive received for CEM ID:', cemId)
      node.send([
        null,
        {
          payload: {
            command: 'KeepAlive',
            cemId
          }
        }
      ])
      // D-Bus method must return a value - return true to indicate RM is alive
      return true
    }
  }
}

module.exports = { enableS2Support, MEASUREMENT_TYPE_TO_PROPS }
