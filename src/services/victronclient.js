'use strict';

const createDbusListener = require('./dbus-listener')
const SystemConfiguration = require('./systemconfiguration');
const promiseRetry = require('promise-retry')
const debug = require('debug')('node-red-contrib-victron:victronclient')

/**
 * VictronClient class encapsulates all the necessary functions to
 * both subscribe to dbus value updates as well as write values to dbus.
 * 
 * @param {string} address IP address for dbus over TCP, both address and port. E.g. 127.0.0.1:78
 */
class VictronClient {
    constructor(address) {
        this.dbusAddress = address

        this.write
        this.read
        this.connected = false;

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

                let msgKey = `${msg.senderName}${msg.path}`
                if (msgKey in _this.subscriptions)
                    _this.subscriptions[msgKey].forEach(sub => sub.callback(msg))
            });
        }

        // Use dbus over TCP if an address is given,
        // otherwise, default to systembus
        let dbusConnectionString = null
        if (this.dbusAddress) {
            const address = this.dbusAddress.split(':')
            if (address.length === 2) {
                dbusConnectionString = `tcp:host=${address[0]},port=${address[1]}`
            }
        }

        promiseRetry(retry => {
            // createDbusListener(app, messageCallback, address, plugin, pollInterval)
            return createDbusListener(
                {
                    setProviderStatus: msg => debug(`[PROVIDER STATUS] ${msg}`),
                    setProviderError: msg => debug(`[PROVIDER ERROR] ${msg}`)
                },
                messageHandler,
                dbusConnectionString,
                {
                    onError: msg => debug(`[ERROR] ${msg}`),
                    onServiceChange: (changeType, serviceName) => {
                        debug(`[SERVICE ${changeType}] ${serviceName}`)
                        if (changeType === 'DELETE' && serviceName !== null) {
                            delete this.system.cache[serviceName]
                        }
                    }
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
        .then(dbusHandlers => {
            // on connection, set the status to 'connected' and store the returned handlers
            _this.write = dbusHandlers.setValue
            _this.read = dbusHandlers.getValue

            _this.connected = true // We should probably use the setProviderStatus for various dbus states
        })
    }

    /**
     * a callback that should be called on each received dbus message
     * in order to maintain a list of available devices on the dbus.
     * 
     * @param {object} msg a message object received from the dbus-listener
     */
    saveToCache(msg) {
        //let dbusPaths = this.cache[msg.senderName] || {}
        let dbusPaths = {}
        if (this.system.cache[msg.senderName]) {
            dbusPaths = this.system.cache[msg.senderName]
        } else {
            // Upon first discovery, request the customname and productname
            // of the battery. The returned message gets saved to the cache.
            if (msg.senderName.startsWith('com.victronenergy.battery')) {
                this.read(msg.senderName, '/CustomName')
                this.read(msg.senderName, '/ProductName')
            }
        }

        // some dbus messages are empty arrays []
        if (msg.value.length == 0 ) {
            msg.value = undefined
        }

        dbusPaths[msg.path] = msg.value
        this.system.cache[msg.senderName] = dbusPaths
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
        if (this.connected) {
            debug(`[PUBLISH] ${dbusInterface} - ${path} | ${value}`)
            this.write(dbusInterface, path, value)
        }
        else {
            throw Error('Not connected to dbus. Publish was unsuccessful.')
        }
    }

}


module.exports = VictronClient;
