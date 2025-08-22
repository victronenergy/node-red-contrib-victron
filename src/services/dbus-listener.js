/**
 * Original version forked and modified from
 * https://github.com/sbender9/signalk-venus-plugin/blob/master/dbus-listener.js
 */

const dbus = require('dbus-native-victron')
const { processItemsChanged } = require('./core/dbus-message-processor')
const debug = require('debug')('node-red-contrib-victron:dbus')
const _ = require('lodash')

/**
 * TODO: this documentation comment is outdated
 *
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
      return stack[key].name
    }
  }

  // If no exact match, look for services with the right type
  // by checking if the service name starts with the fallback + "."
  for (const key in stack) {
    if (stack[key].deviceInstance === Number(needle) &&
      stack[key].name.startsWith(fallback + '.')) {
      return stack[key].name
    }
  }

  // If no match at all, then try more loosely matching by service type
  const serviceParts = fallback.split('.')
  const serviceType = serviceParts[serviceParts.length - 1] // Get the last part

  for (const key in stack) {
    if (stack[key].deviceInstance === Number(needle) &&
      stack[key].name.includes('.' + serviceType + '.')) {
      return stack[key].name
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
    this.pollInterval = 5 // seconds
    this.eventHandler = callbacks.eventHandler
    this.messageHandler = callbacks.messageHandler
    this.enablePolling = callbacks.enablePolling !== undefined ? callbacks.enablePolling : false

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
    return new Promise((_resolve, reject) => {
      // this promise never resolves. The retry mechanism depends on us rejecting when
      // we get disconnected, see VictronClient.promiseRetry().
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
        console.log('Connected to D-Bus.')

        this.bus.listNames((props, args) => {
          args.forEach(name => {
            debug(`listNames, found service: ${name}`)
            if (name.startsWith('com.victronenergy')) { this.bus.getNameOwner(name, (props, args) => this._initService(args, name)) }
          })
        })

        if (this.enablePolling) {
          console.warn('Polling is enabled. This is deprecated behavior.')
          this.rootPoller = setInterval(
            async () => {
              return await this._requestAllRoots()
            },
            this.pollInterval * 1000
          )
        } else {
          console.warn('Polling is disabled. This is the recommended configuration.')
          // without polling, we request all roots once
          this._requestAllRoots()
            .then(() => {
              console.log('Polling is disabled. All roots have been requested once successfully.')
            })
            .catch(err => {
              console.error('Error requesting all roots:', err)
            })
        }

        // The following callbacks should be initialized
        // only after dbus connection
        this.bus.connection.on('message', this._signalRecieve)
        this.bus.connection.on('end', () => {
          if (this.rootPoller) {
            clearInterval(this.rootPoller)
          }
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
        // TODO: instead of (!...) we now use (... === undefined), which allows for deviceInstance === 0 without error log output
        // note that this does not change semantics, other than the error log output
        if (this.services[owner].deviceInstance === undefined) {
          console.error(`deviceInstance could not be assigned because res[1][0] is undefined owner=${owner} services[owner]=${JSON.stringify(this.services[owner])} (${this.services[owner].name})`)
          // TODO: Handle the case where res[1][0] is undefined
        }
      }
      if (err && err.length > 0) {
        debug(`initService ${name} : ${err}`)
      }
    })
    this._requestRoot(service)
  }

  _requestRoot (service) {
    return new Promise((resolve, reject) => {
      this.bus.invoke({
        path: '/',
        destination: service.name,
        interface: 'com.victronenergy.BusItem',
        member: 'GetItems'
      },
      (err, res) => {
        if (err) {
          const matchIfVirtual = service.name.match(/^com\.victronenergy\.(\w+)\.virtual_*/)
          if (matchIfVirtual) {
            console.warn(`Unable to request root for virtual service ${service.name}, this is fine when reconnecting.`)
            return resolve()
          }
          return reject(err)
        }
        const data = {}
        const getTargetValue = (arr) => arr[arr.findIndex(innerArr => innerArr[0] === 'Value')]?.[1]?.[1]?.[0]

        debug('requestRoot, service.name, res.length', service.name, res.length)
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
        debug('requestRoot, messages', messages)
        this.messageHandler(messages)
        resolve()
      })
    })
  }

  async _requestAllRoots () {
    // Previously, we did this:
    // _.values(this.services).forEach(service => this._requestRoot(service))
    // ... but now we need to request all roots in more than one place,
    // and we want to measure the time it takes to do so.
    const start = new Date()
    debug('_requestAllRoots, start', start)

    const promises = []
    for (const key in this.services) {
      debug(`_requestAllRoots, key=${key}`)
      promises.push(this._requestRoot(this.services[key]))
    }
    await Promise.all(promises)
    const end = new Date()
    debug(`_requestAllRoots, duration=${end - start} milliseconds`)
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
        debug('ItemsChanged', msg)
        const messages = processItemsChanged(msg, this.services, searchDeviceInstanceByName, false)
        this.messageHandler(messages)
        break
      }
      case 'PropertiesChanged': {
        debug('PropertiesChanged', msg)
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
    let invokeDestination = destination
    if (destination.split('/').length === 2) {
      const deviceInstance = destination.split('/')[1]
      invokeDestination = searchHaystack(this.services, deviceInstance, destination.split('/')[0])
    }
    this.bus.invoke({
      path,
      destination: invokeDestination,
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

  setValue (destination, path, value, cb) {
    let numType = 'd'

    // Check if we need to find the full path
    if (destination.split('/').length === 2) {
      const deviceInstance = destination.split('/')[1]

      if (!this.services || Object.keys(this.services).length === 0) {
        const err = new Error('No services available yet. Try again later.')
        console.error(`Error in setValue: ${err.message}`)
        if (cb) cb(err)
        return
      }

      destination = searchHaystack(this.services, deviceInstance, destination.split('/')[0])
    }

    if (Number.isInteger(value)) { numType = 'i' }
    if (typeof value === 'string') { numType = 's' }

    try {
      debug(`Setting value for ${destination}, ${path}, ${value} (${numType})`)
      this.bus.invoke({
        path,
        destination,
        interface: 'com.victronenergy.BusItem',
        member: 'SetValue',
        body: [[numType, value]],
        signature: 'v'
      },
      err => {
        if (err) {
          console.error(`Error setting value for ${destination}, ${path}, ${value}: ${err}`)
          if (cb) cb(err)
        } else {
          if (cb) cb(null)
        }
      })
    } catch (error) {
      console.error(`Exception in setValue: ${error.message}`)
      if (cb) process.nextTick(() => cb(error))
    }
  }
}

module.exports = VictronDbusListener
