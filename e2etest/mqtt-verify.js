'use strict'

// MQTT-based value verification via VRM WebSocket MQTT broker.
//
// Broker: wss://webmqtt{index}.victronenergy.com  (index derived from portal ID)
// Auth:   username = VRM email, password = "Token {VRM_API_TOKEN}"
// Read:   N/{portalId}/{serviceType}/{deviceInstance}/{path}
// Write:  W/{portalId}/{serviceType}/{deviceInstance}/{path}  payload: {"value": <v>}
//
// The deviceInstance is resolved via the settings service topic:
//   N/{portalId}/settings/0/Settings/Devices/{suffix}/ClassAndVrmInstance
// which publishes a string like "switch:0" (class:instance).
//
// Required env vars: VRM_API_TOKEN
// Optional env vars: VRM_PORTAL_ID (default c0619ab4e242), VRM_MQTT_USERNAME (VRM email)

const https = require('https')
const mqtt = require('mqtt')

const { VRM_PORTAL_ID, VRM_API_TOKEN } = process.env

if (!VRM_PORTAL_ID) throw new Error('VRM_PORTAL_ID env var is required')

const VALUE_TIMEOUT_MS = 15_000
const CONNECT_TIMEOUT_MS = 15_000
const WRITE_ECHO_TIMEOUT_MS = 10_000

let sharedClient = null
// topic -> last published value
const valueCache = new Map()
// topic -> Set<(value) => void>  - one-shot waiters
const pendingWaiters = new Map()

function getBrokerUrl () {
  let sum = 0
  for (const c of VRM_PORTAL_ID.toLowerCase().trim()) sum += c.charCodeAt(0)
  const index = sum % 128
  return `wss://webmqtt${index}.victronenergy.com`
}

function httpsGet (path) {
  return new Promise((resolve, reject) => {
    if (!VRM_API_TOKEN) throw new Error('VRM_API_TOKEN env var is required')
    const req = https.request({
      hostname: 'vrmapi.victronenergy.com',
      path,
      method: 'GET',
      headers: { 'x-authorization': `Token ${VRM_API_TOKEN}` }
    }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.end()
  })
}

let cachedMqttUsername = process.env.VRM_MQTT_USERNAME || null

async function getMqttUsername () {
  if (cachedMqttUsername) return cachedMqttUsername
  const res = await httpsGet('/v2/users/me')
  if (res.status !== 200) throw new Error(`VRM /users/me returned ${res.status}: ${res.body}`)
  const data = JSON.parse(res.body)
  const email = (data.user || data.record || {}).email
  if (!email) throw new Error(`No email in VRM /users/me response: ${res.body}`)
  cachedMqttUsername = email
  return email
}

function handleIncomingMessage (topic, buf) {
  let value
  try {
    value = JSON.parse(buf.toString()).value
  } catch (_) {
    return
  }
  valueCache.set(topic, value)
  const waiters = pendingWaiters.get(topic)
  if (waiters && waiters.size > 0) {
    for (const cb of waiters) cb(value)
    pendingWaiters.delete(topic)
  }
}

async function getClient () {
  if (sharedClient && sharedClient.connected) return sharedClient
  if (sharedClient) { sharedClient.end(true); sharedClient = null }

  let client

  const brokerUrl = process.env.LOCAL_MQTT_ENDPOINT || getBrokerUrl()

  if (process.env.LOCAL_MQTT_ENDPOINT) {
    console.warn('Using LOCAL_MQTT_ENDPOINT for MQTT connection: ', brokerUrl)

    client = mqtt.connect(brokerUrl, {
      protocolVersion: 4,
      clean: true,
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectPeriod: 0
    })
  } else {
    const username = await getMqttUsername()

    client = mqtt.connect(brokerUrl, {
      username,
      password: `Token ${VRM_API_TOKEN}`,
      protocolVersion: 4,
      clean: true,
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectPeriod: 0
    })
  }

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`MQTT connect timeout (${brokerUrl})`)), CONNECT_TIMEOUT_MS)
    client.once('connect', () => { clearTimeout(t); resolve() })
    client.once('error', err => { clearTimeout(t); reject(err) })
  })

  client.on('message', handleIncomingMessage)

  // Subscribe to all portal values, then publish keepalive to trigger initial dump.
  // Devices with "active keepalive" mode (no retained messages) only publish when
  // they receive a keepalive on R/{portalId}/keepalive. Wait for
  // N/{portalId}/full_publish_completed to know the dump is done.
  await new Promise((resolve, reject) => {
    const fullPublishTopic = `N/${VRM_PORTAL_ID}/full_publish_completed`
    const t = setTimeout(() => reject(new Error('Timeout waiting for full_publish_completed')), CONNECT_TIMEOUT_MS)

    client.subscribe(`N/${VRM_PORTAL_ID}/#`, err => {
      if (err) { clearTimeout(t); return reject(err) }
      client.publish(`R/${VRM_PORTAL_ID}/keepalive`, '', publishErr => {
        if (publishErr) { clearTimeout(t); return reject(publishErr) }
      })
    })

    const onComplete = (topic) => {
      if (topic === fullPublishTopic) {
        client.removeListener('message', onComplete)
        clearTimeout(t)
        resolve()
      }
    }
    client.on('message', onComplete)
  })

  // Send suppress-republish keepalives every 30s so the GX device keeps streaming
  const keepaliveInterval = setInterval(() => {
    if (client.connected) client.publish(`R/${VRM_PORTAL_ID}/keepalive`, JSON.stringify({ 'keepalive-options': ['suppress-republish'] }))
  }, 30_000)
  keepaliveInterval.unref()

  sharedClient = client
  return client
}

function waitForTopic (topic, timeoutMs) {
  const cached = valueCache.get(topic)
  if (cached !== undefined) return Promise.resolve(cached)

  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const waiters = pendingWaiters.get(topic)
      if (waiters) waiters.delete(resolve)
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for MQTT topic: ${topic}`))
    }, timeoutMs)

    const cb = val => { clearTimeout(t); resolve(val) }
    if (!pendingWaiters.has(topic)) pendingWaiters.set(topic, new Set())
    pendingWaiters.get(topic).add(cb)
  })
}

// "com.victronenergy.switch.virtual_switch1" -> { serviceType: 'switch', suffix: 'virtual_switch1' }
function parseServiceName (serviceName) {
  const parts = serviceName.split('.')
  // parts: ['com', 'victronenergy', serviceType, ...suffix_parts]
  return { serviceType: parts[2], suffix: parts.slice(3).join('.') }
}

async function resolveDeviceInstance (suffix, serviceType) {
  const settingsTopic = `N/${VRM_PORTAL_ID}/settings/0/Settings/Devices/${suffix}/ClassAndVrmInstance`
  // e.g. value = "switch:0"
  const classAndInstance = String(await waitForTopic(settingsTopic, VALUE_TIMEOUT_MS))
  const colonIdx = classAndInstance.lastIndexOf(':')
  if (colonIdx === -1) throw new Error(`Unexpected ClassAndVrmInstance: ${classAndInstance} (${serviceType}/${suffix})`)
  const instance = parseInt(classAndInstance.slice(colonIdx + 1), 10)
  if (isNaN(instance)) throw new Error(`Cannot parse instance from ClassAndVrmInstance: ${classAndInstance}`)
  return instance
}

async function mqttGetValue (serviceName, path) {
  await getClient()
  const { serviceType, suffix } = parseServiceName(serviceName)
  const deviceInstance = await resolveDeviceInstance(suffix, serviceType)
  const cleanPath = path.replace(/^\//, '')
  const topic = `N/${VRM_PORTAL_ID}/${serviceType}/${deviceInstance}/${cleanPath}`
  return waitForTopic(topic, VALUE_TIMEOUT_MS)
}

async function mqttSetValue (serviceName, path, value) {
  const client = await getClient()
  const { serviceType, suffix } = parseServiceName(serviceName)
  const deviceInstance = await resolveDeviceInstance(suffix, serviceType)
  const cleanPath = path.replace(/^\//, '')
  const writeTopic = `W/${VRM_PORTAL_ID}/${serviceType}/${deviceInstance}/${cleanPath}`
  const readTopic = `N/${VRM_PORTAL_ID}/${serviceType}/${deviceInstance}/${cleanPath}`

  // Remove cached value so waitForTopic will block until the broker echoes the write
  valueCache.delete(readTopic)
  const echoPromise = waitForTopic(readTopic, WRITE_ECHO_TIMEOUT_MS)

  await new Promise((resolve, reject) => {
    client.publish(writeTopic, JSON.stringify({ value }), { qos: 0 }, err => {
      if (err) reject(err)
      else resolve()
    })
  })

  // Wait for the broker to echo the new value back on the N/ topic
  await echoPromise
}

module.exports = { mqttGetValue, mqttSetValue }
