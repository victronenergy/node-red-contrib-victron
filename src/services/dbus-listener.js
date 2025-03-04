/**
 * Original version forked and modified from
 * https://github.com/sbender9/signalk-venus-plugin/blob/master/dbus-listener.js
 */

const dbus = require('dbus-native-victron')
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

function searchHaystack (stack, needle, fallback) {
  // First try to find exact match with device instance
  for (const key in stack) {
    if (stack[key].deviceInstance === Number(needle) &&
        stack[key].name === fallback) {
      return stack[key].name;
    }
  }

  // If no exact match, look for services with the right type
  // by checking if the service name starts with the fallback + "."
  for (const key in stack) {
    if (stack[key].deviceInstance === Number(needle) &&
        stack[key].name.startsWith(fallback + ".")) {
      return stack[key].name;
    }
  }

  // If no match at all, then try more loosely matching by service type
  const serviceParts = fallback.split(".");
  const serviceType = serviceParts[serviceParts.length - 1]; // Get the last part

  for (const key in stack) {
    if (stack[key].deviceInstance === Number(needle) &&
        stack[key].name.includes("." + serviceType + ".")) {
      return stack[key].name;
    }
  }
  return fallback
}

function searchDeviceInstanceByName (stack, needle, fallback) {
  for (const key in stack) {
    if (stack[key].name === needle) {
      return stack[key].deviceInstance
    }
  }
  return fallback
}

class VictronDbusListener {
  constructor (address, callbacks) {
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

  connect () {
    return new Promise((resolve, reject) => {
      if (this.address) { // Connect via TCP
        debug(`Connecting to TCP address ${this.address}.`)
        this.bus = dbus.createClient({
          busAddress: this.address,
          authMethods: ['ANONYMOUS']
        })
      } else { // Connect via socket
        debug('Connecting to system socket.')
        this.bus = process.env.DBUS_SESSION_BUS_ADDRESS
          ? dbus.sessionBus()
          : dbus.systemBus()
      }

      if (!this.bus) { throw new Error('Could not connect to the D-Bus') }

      // Event callbacks
      this.bus.connection.on('connect', () => {
        debug('Connected to D-Bus.')

        this.bus.listNames((props, args) => {
          args.forEach(name => {
            if (name.startsWith('com.victronenergy')) { this.bus.getNameOwner(name, (props, args) => this._initService(args, name)) }
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
          reject(new Error('dbus connection end'))
        })

        this.connected = true
      })

      this.bus.connection.on('error', (err) => {
        this.connected = false
        console.error(`Error connecting to dbus: ${err}`)
        reject(new Error('dbus connection error'))
      })

      this.bus.addMatch("type='signal',interface='com.victronenergy.BusItem',member='ItemsChanged'", () => { })
      this.bus.addMatch("type='signal',interface='com.victronenergy.BusItem',member='PropertiesChanged'", () => { })
      this.bus.addMatch("type='signal',member='NameOwnerChanged'", () => { })
    })
  }

  _initService (owner, name) {
    const service = { name }
    this.bus.invoke({
      path: '/DeviceInstance',
      destination: name,
      interface: 'com.victronenergy.BusItem',
      member: 'GetValue'
    },
    (err, res) => {
      this.services[owner] = service
      if (res) {
        this.services[owner].deviceInstance = res[1]?.[0]
        if (!this.services[owner].deviceInstance) {
          console.error(`deviceInstance could not be assigned because res[1][0] is undefined ${owner}/${this.services[owner]} (${this.services[owner].name})`)
          // Handle the case where res[1][0] is undefined
        }
      }
      if (err && err.length > 0) {
        debug(`initService ${name} : ${err}`)
      }
    })
    this._requestRoot(service)
  }

  _requestRoot (service) {
    this.bus.invoke({
      path: '/',
      destination: service.name,
      interface: 'com.victronenergy.BusItem',
      member: 'GetItems'
    },
    (err, res) => {
      if (!err) {
        const data = {}
        const getTargetValue = (arr) => arr[arr.findIndex(innerArr => innerArr[0] === 'Value')]?.[1]?.[1]?.[0]

        res.forEach(([path, values]) => {
          data[path] = getTargetValue(values)
        })

        if (!_.isUndefined(data.FluidType)) {
          service.fluidType = data.FluidType
        }

        if (!service.deviceInstance && data['/DeviceInstance'] != null) {
          service.deviceInstance = data['/DeviceInstance']
        }

        const deviceInstance = data['/DeviceInstance'] != null ? data['/DeviceInstance'] : service.deviceInstance

        const messages = _.keys(data).map(path => {
          return {
            path: '/' + path.replace(/^\/+/, ''),
            senderName: service.name.split('.').splice(0, 3).join('.'),
            value: data[path],
            deviceInstance,
            fluidType: service.fluidType
          }
        })
        this.messageHandler(messages)
      }
    })
  }

  _signalRecieve (msg) {
    if (msg.interface !== 'com.victronenergy.BusItem') {
      if (msg.interface === 'org.freedesktop.DBus' &&
                msg.member === 'NameOwnerChanged') {
        const name = msg.body[0]

        if (name.startsWith('com.victronenergy')) {
          const newOwner = msg.body[2]
          if (newOwner) {
            this._initService(newOwner, name)
            this.eventHandler('INITIALIZE', name)
          }
        } else {
          const oldOwner = msg.body[1]
          if (oldOwner && this.services[oldOwner]) {
            const trail = ('/' + (this.services[oldOwner].deviceInstance != null ? this.services[oldOwner].deviceInstance : '')).replace(/\.$/, '')
            const svcName = this.services[oldOwner].name.split('.').splice(0, 3).join('.') + trail
            this.eventHandler('DELETE', this.services[oldOwner].name)
            delete this.services[oldOwner]
            this.eventHandler('DELETE', svcName)
          }
        }
      }
      return
    }

    const messages = []
    switch (msg.member) {
      case 'ItemsChanged': {
        msg.body[0].forEach(entry => {
          const m = { changed: true }
          m.path = entry[0]
          if (entry[1] && entry[1].length === 2) {
            entry[1].forEach(v => {
              switch (v[0]) {
                case 'Value': m.value = v[1][1][0]; break
                case 'Text': m.text = v[1][1][0]; break
              }
            })
          }
          if (!m.path || m.value === null || !m.text) {
            return
          }
          const service = this.services[msg.sender]
          if (!service || !service.name) {
            return
          }
          if (m.path === '/DeviceInstance') {
            service.deviceInstance = m.value
          }
          m.senderName = service.name.split('.').splice(0, 3).join('.')
          if (service.deviceInstance === null) {
            service.deviceInstance = searchDeviceInstanceByName(this.services, m.senderName, '')
          }
          m.deviceInstance = service.deviceInstance
          messages.push(m)
        })
        break
      }
      case 'PropertiesChanged': {
        if (msg.body[0] && msg.body[0].length === 2) {
          const m = msg
          msg.body[0].forEach(v => {
            switch (v[0]) {
              case 'Value': m.value = v[1][1][0]; break
              case 'Text': m.text = v[1][1][0]; break
            }
          })
          if (!m.path || m.value === null || !m.text) {
            return
          }
          const service = this.services[msg.sender]
          if (!service || !service.name) {
            return
          }
          m.senderName = service.name.split('.').splice(0, 3).join('.')
          m.deviceInstance = service.deviceInstance
          if (service.deviceInstance === null) {
            service.deviceInstance = searchDeviceInstanceByName(this.services, m.senderName, '')
          }
          m.changed = true
          messages.push(m)
        }
        break
      }
      default: {
        debug(`Unexpected message: ${msg}`)
      }
    }
    this.messageHandler(messages)
  }

  getValue (destination, path) {
    this.bus.invoke({
      path,
      destination,
      interface: 'com.victronenergy.BusItem',
      member: 'GetValue'
    },
    (err, res) => {
      if (!err) {
        destination = destination.split('.').splice(0, 3).join('.')
        if (path === '/DeviceInstance') {
          destination += '/' + res[1][0]
        }
        this.messageHandler([{
          path,
          senderName: destination,
          value: res[1][0]
        }])
      }
    })
  }

  setValue (destination, path, value) {
    let numType = 'd'

    // Check if we need to find the full path
    if (destination.split('/').length === 2) {
      const deviceInstance = destination.split('/')[1]
      destination = searchHaystack(this.services, deviceInstance, destination.split('/')[0])
    }

    if (Number.isInteger(value)) { numType = 'i' }
    if (typeof value === 'string') { numType = 's' }
    this.bus.invoke({
      path,
      destination,
      interface: 'com.victronenergy.BusItem',
      member: 'SetValue',
      body: [[numType, value]],
      signature: 'v'
    },
    err => {
      if (err) console.error(`Error setting value for ${destination}, ${path}, ${value}: ${err}`)
    }
    )
  }
}

module.exports = VictronDbusListener
