'use strict';

const createDbusListener = require('./dbus-listener')
const SystemConfiguration = require('./systemconfiguration');
const promiseRetry = require('promise-retry')
const debug = require('debug')('node-red-contrib-victron:victronclient')

/**
 * VictronClient class encapsulates all the necessary functions to
 * both subscribe to dbus value updates as well as write values to dbus.
 * 
 * @param {string} address IP address for dbus over TCP
 * @param {string} port dbus over TCP port
 */
class VictronClient {
    constructor(address, port) {
        this.dbusAddress = address || '127.0.0.1'
        this.dbusPort = port || '78'
        this.subscriptions = {} // an array of subscription objects [{ "topic": topic, "handler": function }, ...]
        this.write
        this.system = new SystemConfiguration()

        this.connected = false;
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
                _this.system.serviceDiscoveryCallback(msg)
                let msgKey = `${msg.senderName}${msg.path}`
                if (msgKey in _this.subscriptions)
                    _this.subscriptions[msgKey].forEach(sub => sub.callback(msg))
            });
        }

        promiseRetry(retry => {
            // createDbusListener(app, messageCallback, address, plugin, pollInterval)
            return createDbusListener(
                {
                    setProviderStatus: msg => debug(`[PROVIDER STATUS] ${msg}`),
                    setProviderError: msg => debug(`[PROVIDER ERROR] ${msg}`)
                },
                messageHandler,
                `tcp:host=${_this.dbusAddress},port=${_this.dbusPort}`,
                {
                    onError: msg => debug(`[ERROR] ${msg}`)
                },
                5
            )
            .catch(retry)
        },
        {
            maxTimeout: 30 * 1000,
            forever: true
        }
        )
        .then(dbusCallbacks => {
            // on connection, set the status to 'connected' and store the dbus write function
            _this.write = dbusCallbacks.setValue
            _this.connected = true // We should probably use the setProviderStatus for various dbus states
        })
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
        const subscriptionId = Math.floor((1 + Math.random()) * 0x10000000).toString(16); // unique enough, used for unsubscribing

        let newSubscription =  {callback, dbusInterface, path, subscriptionId}

        let msgKey = dbusInterface + path
        if (msgKey in this.subscriptions)
            this.subscriptions[msgKey].push(newSubscription)
        else
            this.subscriptions[msgKey] = [newSubscription]

        debug(`[SUBSCRIBE] [${dbusInterface} | ${path}] ID: ${subscriptionId}`)

        return subscriptionId;
    }

    /**
     * Unsubscribes a node from a list of dbus message listeners
     * 
     * @param {string} subscriptionId a semi-unique string identifying a single node-specific message listener
     */
    unsubscribe(subscriptionId) {
        Object.keys(this.subscriptions).forEach(topic => {
            this.subscriptions[topic] = this.subscriptions[topic].filter(obj => obj.id !== subscriptionId)
        });
        debug(`[UNSUBSCRIBE] ${subscriptionId}`)
    }

    /**
     * 
     * @param {string} dbusInterface a dbus interface, e.g. e.g. com.victronenergy.system
     * @param {string} path specific path to publish to, e.g. /Relay/0/State
     * @param {string} value value to write to the given dbus service, e.g. 1
     */
    publish(dbusInterface, path, value) {
        this.write(dbusInterface, path, value)
    }

}


module.exports = VictronClient;
