/**
 * Original version forked and modified from
 * https://github.com/sbender9/signalk-venus-plugin/blob/master/dbus-listener.js
 */

const dbus = require('dbus-native')
const debug = require('debug')('node-red-contrib-victron:dbus')
const _ = require('lodash')


/**
 * VictronDbusListener encapsulates the dbus communications
 * between Node-RED and Venus system. It establishes a dbus
 * connection and exposes relevant callbacks to its owner.
 *
 * The class frequently polls relevant dbus rootPaths to
 * keep track of available dbus services.
 *
 * Usage:
        new VictronDbusListener(
            tcpAddress,
            {eventHandler, messageHandler}
        ).connect()
        .then(callbacks => {
            setValueFunc = callbacks.setValue
            getValueFunc = callbacks.getValue
        })
        .catch(err => console.error)
 */
class VictronDbusListener {
    constructor(address, callbacks) {
        this.address = address
        this.pollInterval = 5
        this.eventHandler = callbacks.eventHandler
        this.messageHandler = callbacks.messageHandler

        this.bus = null
        this.rootPoller = null

        this.services = {}
        this.connected = false

        // We need to bind the scope to getValue and setvalue,
        // since they can be invoked elsewhere
        this.getValue = this.getValue.bind(this)
        this.setValue = this.setValue.bind(this)
        this._signalRecieve = this._signalRecieve.bind(this)
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.address) { // Connect via TCP
                debug(`Connecting to TCP address ${this.address}.`)
                this.bus = dbus.createClient({
                    busAddress: this.address,
                    authMethods: ['ANONYMOUS']
                })
            }
            else { // Connect via socket
                debug(`Connecting to system socket.`)
                this.bus = process.env.DBUS_SESSION_BUS_ADDRESS
                    ? dbus.sessionBus()
                    : dbus.systemBus()
            }

            if (!this.bus)
                throw new Error('Could not connect to the D-Bus')

            // Event callbacks
            this.bus.connection.on('connect', () => {
                debug("Connected to D-Bus.")

                this.bus.listNames((props, args) => {
                    args.forEach(name => {
                        if (name.startsWith('com.victronenergy'))
                            this.bus.getNameOwner(name, (props, args) => this._initService(args, name))
                    })
                })

                this.rootPoller = setInterval(
                    () => _.values(this.services).forEach(service => this._requestRoot(service)),
                    this.pollInterval * 1000
                )

                // The following callbacks should be initialized
                // only after dbus connection
                this.bus.connection.on('message', this._signalRecieve)
                this.bus.connection.on('end', () => {
                    clearInterval(this.rootPoller)
                    this.connected = false
                    console.error('Lost connection to D-Bus.')
                })

                this.connected = true
                resolve()
            })

            this.bus.connection.on('error', (err) => {
                console.error(`Error connecting to dbus: ${err}`)
                reject()
            })

            //Timeout the connection after 5 seconds if not connected
            setTimeout(reject, 10 * 1000)

            this.bus.addMatch("type='signal',interface='com.victronenergy.BusItem',member='ItemsChanged'", () => { })
            this.bus.addMatch("type='signal',interface='com.victronenergy.BusItem',member='PropertiesChanged'", () => { })
            this.bus.addMatch("type='signal',member='NameOwnerChanged'", () => { })
        })
    }

    _initService(owner, name) {
        let service = { name }
        this.services[owner] = service

        this.bus.invoke({
            path: '/DeviceInstance',
            destination: name,
            interface: 'com.victronenergy.BusItem',
            member: 'GetValue'
        },
            (err, res) => {
                if (res)
                    this.services[owner].deviceInstance = res[1][0]
            })
        this._requestRoot(service)
    }

    _requestRoot(service) {
        this.bus.invoke({
            path: '/',
            destination: service.name,
            interface: 'com.victronenergy.BusItem',
            member: 'GetValue'
        },
            (err, res) => {
                if (!err) {
                    let data = {}

                    res[1][0].forEach(kp => {
                        data[kp[0]] = kp[1][1][0]
                    })

                    service.deviceInstance = data.DeviceInstance

                    if (!_.isUndefined(data.FluidType)) {
                        service.fluidType = data.FluidType
                    }

                    const messages = _.keys(data).map(path => {
                        return {
                            path: '/' + path,
                            senderName: service.name,
                            value: data[path],
                            instanceName: service.deviceInstance,
                            fluidType: service.fluidType
                        }
                    })

                    this.messageHandler(messages)
                }
            })
    }

    _signalRecieve(msg) {
        // Handle messages
        if (msg.interface === 'com.victronenergy.BusItem' &&
            (msg.member === 'ItemsChanged' || msg.member === 'PropertiesChanged')) {
            if (msg.member === 'PropertiesChanged') {
                msg.body[0].forEach(entry => {
                    if (entry[0] === 'Text')
                        msg.text = entry[1][1][0]
                    else if (entry[0] === 'Value')
                        msg.value = entry[1][1][0]
                })
            } else {
                // ItemsChanged
                msg.body[0].forEach(entry => {
                    if (entry[1][1][0] === 'Text')
                        msg.text = entry[1][1][1][1]
                    else if (entry[1][0][0] === 'Value')
                        msg.value = entry[1][0][1][1]
                })
            }

            let service = this.services[msg.sender]

            // Some services don't have the /DeviceInstance path
            if (!service || !service.name) return

            msg.senderName = service.name

            if (msg.path == '/DeviceInstance') {
                this.services[msg.sender].deviceInstance = msg.value
                msg.instanceName = msg.value
            } else {
                msg.instanceName = service.deviceInstance
            }

            this.messageHandler([msg])
        }
        // Handle newly registered / deleted dbus services
        else if (msg.interface == 'org.freedesktop.DBus' &&
            msg.member == 'NameOwnerChanged') {
            const name = msg.body[0]

            if (name.startsWith('com.victronenergy')) {
                const new_owner = msg.body[2]
                this._initService(new_owner, name)
                this.eventHandler("INITIALIZE", name)
            } else {
                const old_owner = msg.body[1]
                let svcName = this.services[old_owner] ? this.services[old_owner].name : null
                delete this.services[old_owner]
                this.eventHandler("DELETE", svcName)
            }

        }
    }

    getValue(destination, path) {
        this.bus.invoke({
            path: path,
            destination: destination,
            interface: 'com.victronenergy.BusItem',
            member: 'GetValue'
        },
            (err, res) => {
                if (!err) {
                    this.messageHandler([{
                        path: path,
                        senderName: destination,
                        value: res[1][0]
                    }])
                }
            })
    }

    setValue(destination, path, value) {
        var num_type = 'd'

        if ( Number.isInteger(value) ) { num_type = 'n' }
        this.bus.invoke({
            path: path,
            destination: destination,
            interface: 'com.victronenergy.BusItem',
            member: 'SetValue',
            body: [[num_type, value]],
            signature: 'v'
        },
            err => {
                if (err) console.error('Error: ' + err)
            }
        )
    }
}

module.exports = VictronDbusListener
