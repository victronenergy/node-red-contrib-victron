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
        this.client

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
        let _this = this

        // messageHandler gets a list of received messages as a parameter
        // and matches them with the registered subscriptions invoking their callback
        const messageHandler = messages => {
            messages.forEach(msg => {
                _this.saveToCache(msg)
                let trail = ('/' + (msg.deviceInstance != null ? msg.deviceInstance : '')).replace(/\/$/, '')
                let msgKey = `${msg.senderName}${trail}:${msg.path}`
                if (msgKey in _this.subscriptions)
                    _this.subscriptions[msgKey].forEach(sub => sub.callback(msg))
            })
        }

        const eventHandler = (changeType, serviceName) => {
            if (changeType === 'DELETE' && serviceName !== null) {
                delete this.system.cache[serviceName]
                this.onStatusUpdate({ "service": serviceName }, utils.STATUS.SERVICE_REMOVE)
            }
            if (changeType === 'INITIALIZE') {
                this.onStatusUpdate({ "service": serviceName }, utils.STATUS.SERVICE_MIGRATE)
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

        promiseRetry(retry => {
            return this.client
                .connect()
                .catch(retry)
        },
            {
                factor: 1,
                forever: true,
                minTimeout: 5 * 1000
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

        if (this.system.cache[msg.senderName + trail])
            dbusPaths = this.system.cache[msg.senderName + trail]

        // some dbus messages are empty arrays []
        if (msg.value && msg.value.length == 0)
            msg.value = null

        // We need to update the nodes on new paths
        // e.g. in the case of system relays, which might or might not be there
        const sender = msg.senderName.split('.').splice(0, 3).join('.') + trail
        if (!(msg.path in dbusPaths))
            this.onStatusUpdate({ 'service': sender, 'path': msg.path, }, utils.STATUS.PATH_ADD)
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
    subscribe(dbusInterface, path, callback) {
        const subscriptionId = utils.UUID()
        const newSubscription = { callback, dbusInterface, path, subscriptionId }

        const msgKey = dbusInterface + ':' + path
        if (msgKey in this.subscriptions)
            this.subscriptions[msgKey].push(newSubscription)
        else
            this.subscriptions[msgKey] = [newSubscription]

        debug(`[SUBSCRIBE] ${subscriptionId} | ${dbusInterface} ${path}`)

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
            const removed = _.remove(topicSubscription, { subscriptionId: subscriptionId })

            if (removed.length > 0) { // successfully unsubscribed
                debug(`[UNSUBSCRIBE] ${subscriptionId} | ${removed[0].dbusInterface} ${removed[0].path}`)

                // if the removed item was the only one in the array,
                // delete the property to keep the subscriptions object clean
                if (topicSubscription.length === 0)
                    delete this.subscriptions[topic]
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
    publish(dbusInterface, path, value) {
        if (this.client && this.client.connected) {
            debug(`[PUBLISH] ${dbusInterface} ${path} | ${value}`)
            this.client.setValue(dbusInterface, path, value)
        }
        else {
            console.error('Not connected to dbus. Publish was unsuccessful.')
        }
    }

}


module.exports = VictronClient
