'use strict'

// MQTT-based value verification via VRM broker.
//
// VRM MQTT broker: mqtts://mqtt.victronenergy.com:8883
// Auth: username = VRM portal ID (the CCGX ID), password = VRM API token
// Read topic:  N/{portalId}/{serviceType}/{instance}/{path}
// Write topic: W/{portalId}/{serviceType}/{instance}/{path}
// Message payload: JSON { "value": <value> }
//
// To enable: set VRM_PORTAL_ID environment variable and implement the functions below.
// Set SKIP_MQTT_VERIFICATION=true to bypass assertions while MQTT is not yet wired up.

async function mqtt_GetValue (serviceName, path) {
  throw new Error('mqtt_GetValue not yet implemented - see testcafe/mqtt-verify.js')
}

async function mqtt_SetValue (serviceName, path, value) {
  throw new Error('mqtt_SetValue not yet implemented - see testcafe/mqtt-verify.js')
}

module.exports = { mqtt_GetValue, mqtt_SetValue }
