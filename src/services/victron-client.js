'use strict'

const VictronDbusListener = require('./dbus-listener')
const SystemConfiguration = require('./victron-system')
const promiseRetry = require('promise-retry')
const _ = require('lodash')
const debug = require('debug')('node-red-contrib-victron:victron-client')
const utils = require('./utils.js')

/**
 * VictronClient class encapsulates all the necessary functions to
 * both subscribe to dbus value updates as well as write values to dbus.
 *
 * @param {string} address IP address for dbus over TCP, both address and port. E.g. 127.0.0.1:78
 */
class VictronClient {
  constructor(address) {
    this.dbusAddress = address
    this.client = null

    // Overwrite the onStatusUpdate to catch relevant VictronClient status updates
    this.onStatusUpdate = () => { }

    this.system = new SystemConfiguration()
    this.subscriptions = {} // an array of subscription objects [{ "topic": topic, "handler": function }, ...]
  }

  /**
     * Connects to the dbus service.
     *
     * example:
     *     let vc = new VictronClient()
     *     await vc.connect()
     */
  async connect() {
    const _this = this

    // messageHandler gets a list of received messages as a parameter
    // and matches them with the registered subscriptions invoking their callback
    const messageHandler = messages => {
      messages.forEach(msg => {
        _this.saveToCache(msg)
        const trail = ('/' + (msg.deviceInstance != null ? msg.deviceInstance : '')).replace(/\/$/, '')
        const msgKey = `${msg.senderName}${trail}:${msg.path}`
        debug(`[MESSAGE HANDLER] ${msgKey} | ${JSON.stringify(msg, null, 2)}`)
        if (msgKey in _this.subscriptions) { _this.subscriptions[msgKey].forEach(sub => sub.callback(msg)) }
      })
    }

    const eventHandler = (changeType, serviceName) => {
      if (changeType === 'DELETE' && serviceName !== null) {
        delete this.system.cache[serviceName]
        this.onStatusUpdate({ service: serviceName }, utils.STATUS.SERVICE_REMOVE)
      }
      if (changeType === 'INITIALIZE') {
        this.onStatusUpdate({ service: serviceName }, utils.STATUS.SERVICE_MIGRATE)
      }
    }

    // Use dbus over TCP if an address is given,
    // otherwise, default to systembus
    let tcpAddress = null
    if (this.dbusAddress) {
      const address = this.dbusAddress.split(':')
      if (address.length === 2) {
        tcpAddress = `tcp:host=${address[0]},port=${address[1]}`
      }
    }

    this.client = new VictronDbusListener(
      tcpAddress,
      { eventHandler, messageHandler }
    )

    /**
     * Subscriptions with option.callbackPeriodically set to true will be called every 5 seconds.
     *
     * This is part of replacing the polling we do in VictronDbusListener._requestRoot(): VictronDbusListener 
     * would cause, by polling dbus every 5 seconds, that each subscription is called every 5 seconds (plus whenever we
     * receive ItemsChanged or PropertiesChanged events). Without the polling, the option.callbackPeriodically
     * is needed to get the same effect for subscriptions that need periodic updates.
     */
    // TODO
    // open question: how do we stop this interval? Are we listening to a disconnect somewhere? And then how do we reconnect?
    // we can probably use this.client.connected?
    setInterval(() => {
      // TODO: we never stop this interval. This may be okay, as there is no mechanism to
      // disconnect from dbus. In other words, once an instance of VictronClient is created,
      // it will always be connected (or try to be connected) to dbus. Thus, we can run the
      // interval indefinitely.
      if (this.client.connected) {
        Object.keys(this.subscriptions).forEach(topic => {
          const topicSubscription = this.subscriptions[topic]
          topicSubscription.forEach(sub => {
            if (sub.options && sub.options.callbackPeriodically) {

              // we need to get the value from the cache
              const data = this.system.cache[sub.dbusInterface]
              debug(`[CALLBACK PERIODICALLY], about to callback, subscriptionId=${sub.subscriptionId} | dbusInterface=${sub.dbusInterface} path=${sub.path} data: ${JSON.stringify(data)}`)

              // we call the callback with the data from the cache
              const [senderName, deviceInstance] = sub.dbusInterface.split('/')
              const value = data[sub.path]
              sub.callback({
                path: sub.path,
                senderName,
                deviceInstance,
                value,
                changed: false,
                text: `${value}` // TODO: we have no text representation in the cache
              })

            }
          })
        })
      }
    }, 5_000)

    promiseRetry(retry => {
      debug('Retrying dbus connection.')
      return this.client
        .connect()
        .catch(retry)
    },
      {
        factor: 2,
        forever: true,
        minTimeout: 5 * 1000,
        maxTimeout: 60 * 1000

      })
      .catch(() => console.error('Unable to connect to dbus.'))
  }

  /**
     * a callback that should be called on each received dbus message
     * in order to maintain a list of available devices on the dbus.
     *
     * @param {object} msg a message object received from the dbus-listener
     */
  saveToCache(msg) {
    let dbusPaths = {}

    const trail = ('/' + (msg.deviceInstance != null ? msg.deviceInstance : '')).replace(/\/$/, '')

    if (this.system.cache[msg.senderName + trail]) { dbusPaths = this.system.cache[msg.senderName + trail] }

    // some dbus messages are empty arrays [], and we interpret empty arrays as null values,
    // compare https://github.com/Chris927/dbus-native/commit/0080b9226a0ed9474be1e5ceeae58a9c78dfa046
    if (msg.value && msg.value.length === 0) { msg.value = null }

    // We need to update the nodes on new paths
    // e.g. in the case of system relays, which might or might not be there
    const sender = msg.senderName.split('.').splice(0, 3).join('.') + trail

    // TODO: this.onStatusUpdate() is a noop, can perhaps be removed
    if (!(msg.path in dbusPaths)) { this.onStatusUpdate({ service: sender, path: msg.path }, utils.STATUS.PATH_ADD) }

    dbusPaths[msg.path] = msg.value
    this.system.cache[msg.senderName + trail] = dbusPaths
  }

  /**
     * Subscribes to a dbus service, provided a valid interface and path were given.
     * The callback function is invoked for each subscribed whenever a valid subscription matching the message path and interface is found.
     *
     * @param {string} dbusInterface user specified dbus interface, e.g. com.victronenergy.system
     * @param {string} path specific path to subscribe to, e.g. /Dc/Battery/Voltage
     * @param {function} callback a callback function which is invoked upon receiving a message that matches both the interface and path
     */
  subscribe(dbusInterface, path, callback, options) {
    const subscriptionId = utils.UUID()
    const newSubscription = { callback, dbusInterface, path, subscriptionId, options }

    const msgKey = dbusInterface + ':' + path
    if (msgKey in this.subscriptions) { this.subscriptions[msgKey].push(newSubscription) } else { this.subscriptions[msgKey] = [newSubscription] }

    debug(`[SUBSCRIBE] ${subscriptionId} | ${dbusInterface} ${path} options=${options}`)

    return subscriptionId
  }

  /**
     * Unsubscribes a node from a list of dbus message listeners
     *
     * @param {string} subscriptionId a semi-unique string identifying a single node-specific message listener
     */
  unsubscribe(subscriptionId) {
    Object.keys(this.subscriptions).forEach(topic => {
      const topicSubscription = this.subscriptions[topic]
      const removed = _.remove(topicSubscription, { subscriptionId })

      if (removed.length > 0) { // successfully unsubscribed
        debug(`[UNSUBSCRIBE] ${subscriptionId} | ${removed[0].dbusInterface} ${removed[0].path}`)

        // if the removed item was the only one in the array,
        // delete the property to keep the subscriptions object clean
        if (topicSubscription.length === 0) { delete this.subscriptions[topic] }
      }
    })
  }

  /**
     * Writes data to dbus services
     *
     * @param {string} dbusInterface a dbus interface, e.g. e.g. com.victronenergy.system
     * @param {string} path specific path to publish to, e.g. /Relay/0/State
     * @param {string} value value to write to the given dbus service, e.g. 1
     */
  publish(dbusInterface, path, value, cb) {
    if (this.client && this.client.connected) {
      debug(`[PUBLISH] ${dbusInterface} ${path} | ${value}`)
      this.client.setValue(dbusInterface, path, value, cb)
    } else {
      const message = 'Not connected to dbus. Publish was unsuccessful.'
      console.error(message)
      if (cb) process.nextTick(() => cb(new Error(message)))
    }
  }
}

module.exports = VictronClient
