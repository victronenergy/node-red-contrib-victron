module.exports = function (RED) {
  const debug = require('debug')('node-red-contrib-victron:victron-nodes')
  const utils = require('../services/utils.js')

  const migrateSubscriptions = (x) => {
    // Check if client is fully initialized
    if (!x.client || !x.client.client || !x.client.client.services) {
      debug('Client not fully initialized for migration. Will retry in 1 second')
      // Retry after a delay
      setTimeout(migrateSubscriptions, 1000, x)
      return
    } else {
      const services = x.client.client.services
      for (const key in services) {
        if (services[key].name === x.service) {
          x.deviceInstance = services[key].deviceInstance
          break
        }
      }
    }
    if (typeof x.deviceInstance !== 'undefined' && x.deviceInstance.toString().match(/^\d+$/)) {
      const dbusInterface = x.service.split('.').splice(0, 3).join('.') + ('/' + x.deviceInstance).replace(/\/$/, '')
      // var dbusInterface = x.service
      const newsub = dbusInterface + ':' + x.path
      const oldsub = x.service + ':' + x.path
      if (x.client.subscriptions[oldsub]) {
        debug(`Migrating subscription from ${oldsub} to ${newsub} (please update your flow)`)
        x.client.subscriptions[oldsub][0].dbusInterface = dbusInterface
        if (newsub in x.client.subscriptions) {
          x.client.subscriptions[newsub].push(x.client.subscriptions[oldsub][0])
        } else {
          x.client.subscriptions[newsub] = x.client.subscriptions[oldsub]
        }
        delete x.client.subscriptions[oldsub]
        delete x.client.system.cache[x.service.split('.').splice(0, 3).join('.')]
        x.client.onStatusUpdate({ service: x.service }, utils.STATUS.SERVICE_MIGRATE)
      }
    } else {
      if (typeof x.deviceInstance !== 'undefined') { debug(`Failed to migrate service ${x.service}`) }
    }
  }

  class BaseInputNode {
    constructor (nodeDefinition) {
      RED.nodes.createNode(this, nodeDefinition)

      this.node = this

      this.service = nodeDefinition.service
      this.path = nodeDefinition.path
      this.pathObj = nodeDefinition.pathObj
      this.defaulttopic = nodeDefinition.serviceObj.name + ' - ' + nodeDefinition.pathObj.name
      this.onlyChanges = nodeDefinition.onlyChanges
      this.roundValues = nodeDefinition.roundValues
      this.sentInitialValue = false

      this.configNode = RED.nodes.getNode('victron-client-id')
      this.client = this.configNode.client

      this.subscription = null

      const handlerId = this.configNode.addStatusListener(this, this.service, this.path)

      if (this.service && this.path) {
        // The following is for migration purposes
        if (!this.service.match(/\/\d+$/)) {
          this.deviceInstance = this.service.replace(/^.*\.(\d+)$/, '$1')
          this.service = this.service.replace(/\.\d+$/, '')
          // Only call getValue if the client is initialized and connected
          if (this.client && this.client.client && this.client.client.connected) {
            this.client.client.getValue(this.service, '/DeviceInstance')
          } else {
            // Log a debug message if we can't get the value yet
            debug('Client not connected yet, delaying getValue call for ' + this.service)
            // We'll rely on the migrateSubscriptions function to retry
          } setTimeout(migrateSubscriptions, 1000, this)
        }

        const isPollingEnabled = this.configNode.enablePolling || false
        const callbackPeriodically = !this.node.onlyChanges && !isPollingEnabled
        this.subscription = this.client.subscribe(this.service, this.path, (msg) => {
          let topic = this.defaulttopic
          if (this.node.name) {
            topic = this.node.name
          }
          if (this.node.onlyChanges && msg.changed === false && this.sentInitialValue) {
            return
          }
          if ((Number(this.node.roundValues) >= 0) && (typeof (msg.value) === 'number')) {
            msg.value = +msg.value.toFixed(this.node.roundValues)
          }
          if (this.node.onlyChanges && this.node.previousvalue === msg.value) {
            return
          }
          if (this.configNode && (this.configNode.contextStore || typeof this.configNode.contextStore === 'undefined')) {
            const transform = (input) => {
              input = input.replace(/^com\./, '')
              return input.replace(/\/(\d+\b)?|\/|(\b\d+\b)/g, (match, p1, p2) => {
                if (p1) return `._${p1}`
                if (p2) return `_${p2}`
                return '.'
              })
            }
            const globalContext = this.node.context().global
            globalContext.set(transform(`${this.service}${this.path}`), msg.value)
          }
          this.node.previousvalue = msg.value
          const outmsg = {
            payload: msg.value,
            topic
          }
          let text = msg.value
          if (this.node.pathObj.type === 'enum') {
            outmsg.textvalue = this.node.pathObj.enum[msg.value] || ''
            text = `${msg.value} (${this.node.pathObj.enum[msg.value]})`
          }
          this.node.send(outmsg)
          if (this.configNode.showValues !== false) {
            // node-red will call toString(), without checking if it exists. If the value is null,
            // node-red will crash trying to call toString(),
            // see https://github.com/node-red/node-red/blob/9bf42037b5f68012a134810ea92ecfe9b6cef112/packages/node_modules/%40node-red/runtime/lib/flows/Flow.js#L512
            // we therefore adjust the value, to ensure toString() is always available.
            const textValue = text && text.toString ? text : text === null || text === undefined ? 'null' : `${text}`
            this.node.status({ fill: 'green', shape: 'dot', text: textValue })
          }
          if (!this.sentInitialValue) {
            this.sentInitialValue = true
          }
        }, { callbackPeriodically })
      }

      if (this.client && this.client.client && this.client.client.connected) {
        this.client.client.getValue(this.service, this.path)
      }

      this.on('close', function (done) {
        this.node.client.unsubscribe(this.node.subscription)
        this.node.configNode.removeStatusListener(handlerId)
        this.sentInitialValue = false
        done()
      })
    }
  }

  class BaseOutputNode {
    constructor (nodeDefinition) {
      RED.nodes.createNode(this, nodeDefinition)

      this.node = this
      this.pathObj = nodeDefinition.pathObj
      this.service = nodeDefinition.service
      this.path = nodeDefinition.path

      // Migrate string initial values to proper types
      let initialValue = nodeDefinition.initial
      if (initialValue !== undefined && initialValue !== null && nodeDefinition.pathObj) {
        const pathType = nodeDefinition.pathObj.type
        if ((pathType === 'float' || pathType === 'integer' || pathType === 'enum') && typeof initialValue === 'string') {
          const numValue = pathType === 'integer' || pathType === 'enum' ? parseInt(initialValue) : parseFloat(initialValue)
          if (!isNaN(numValue)) {
            initialValue = numValue
            debug(`Migrated initial value from string "${nodeDefinition.initial}" to number ${numValue}`)
          }
        }
      }
      this.initialValue = initialValue

      this.configNode = RED.nodes.getNode('victron-client-id')
      this.client = this.configNode.client

      const handlerId = this.configNode.addStatusListener(this, this.service, this.path)

      const setValue = (value, path) => {
        const usedTypes = {
          string: 'string',
          float: 'number',
          enum: 'number',
          integer: 'number',
          object: typeof value,
          number: 'number'
        }

        let writepath = this.path
        let shape = 'dot'

        if (path && path !== this.path) {
          writepath = path
          shape = 'ring'
        }

        if (!/^\/.*/.test(writepath)) {
          writepath = '/' + writepath
        }

        if (!this.pathObj.disabled && this.service && writepath) {
          // If the value is null, just call.
          if (value === null) {
            this.client.publish(this.service, writepath, value, (err) => {
              this.node.status({
                fill: err ? 'red' : 'green',
                shape,
                text: err ? (err.message || 'An unknown error occurred.') : 'Set to null'
              })
            })
            this.node.status({
              fill: 'yellow',
              shape,
              text: 'Setting to null...'
            })
            return
          }

          // Check that the value type matches what's expected
          const valueType = typeof value
          if (valueType !== usedTypes[this.pathObj.type]) {
            this.node.status({
              fill: 'red',
              shape,
              text: `Invalid input type ${valueType}, expecting ${usedTypes[this.pathObj.type]}`
            })
            return
          }

          // Additional validation for enum values
          if (this.pathObj.type === 'enum' && !Object.hasOwn(this.pathObj.enum, value)) {
            this.node.status({
              fill: 'red',
              shape,
              text: 'Invalid enum value'
            })
            return
          }

          const text = this.pathObj.type === 'enum' ? `${value} (${this.pathObj.enum[value]})` : value
          this.client.publish(this.service, writepath, value, (err) => {
            this.node.status({
              fill: err ? 'red' : 'green',
              shape,
              text: err ? (err.message || 'An unknown error occurred') : (this.configNode.showValues === false ? undefined : text)
            })
          })
          this.node.status({
            fill: 'yellow',
            shape,
            text: 'Setting value...'
          })
        }
      }

      // Set initial value only if it's not empty
      if (this.initialValue !== undefined &&
        this.initialValue !== null &&
        this.initialValue !== '') {
        setValue(this.initialValue)
      }

      this.on('input', function (msg) {
        setValue(msg.payload, msg.path)
      })

      this.on('close', function (done) {
        this.node.configNode.removeStatusListener(handlerId)
        done()
      })
    }
  }

  // Input nodes
  RED.nodes.registerType('victron-input-accharger', BaseInputNode)
  RED.nodes.registerType('victron-input-acload', BaseInputNode)
  RED.nodes.registerType('victron-input-acsystem', BaseInputNode)
  RED.nodes.registerType('victron-input-alternator', BaseInputNode)
  RED.nodes.registerType('victron-input-battery', BaseInputNode)
  RED.nodes.registerType('victron-input-custom', BaseInputNode)
  RED.nodes.registerType('victron-input-dcdc', BaseInputNode)
  RED.nodes.registerType('victron-input-dcload', BaseInputNode)
  RED.nodes.registerType('victron-input-dcsource', BaseInputNode)
  RED.nodes.registerType('victron-input-dcsystem', BaseInputNode)
  RED.nodes.registerType('victron-input-dess', BaseInputNode)
  RED.nodes.registerType('victron-input-digitalinput', BaseInputNode)
  RED.nodes.registerType('victron-input-ess', BaseInputNode)
  RED.nodes.registerType('victron-input-evcharger', BaseInputNode)
  RED.nodes.registerType('victron-input-fuelcell', BaseInputNode)
  RED.nodes.registerType('victron-input-generator', BaseInputNode)
  RED.nodes.registerType('victron-input-gps', BaseInputNode)
  RED.nodes.registerType('victron-input-gridmeter', BaseInputNode)
  RED.nodes.registerType('victron-input-inverter', BaseInputNode)
  RED.nodes.registerType('victron-input-meteo', BaseInputNode)
  RED.nodes.registerType('victron-input-motordrive', BaseInputNode)
  RED.nodes.registerType('victron-input-multi', BaseInputNode)
  RED.nodes.registerType('victron-input-pulsemeter', BaseInputNode)
  RED.nodes.registerType('victron-input-pump', BaseInputNode)
  RED.nodes.registerType('victron-input-pvinverter', BaseInputNode)
  RED.nodes.registerType('victron-input-relay', BaseInputNode)
  RED.nodes.registerType('victron-input-settings', BaseInputNode)
  RED.nodes.registerType('victron-input-solarcharger', BaseInputNode)
  RED.nodes.registerType('victron-input-switch', BaseInputNode)
  RED.nodes.registerType('victron-input-system', BaseInputNode)
  RED.nodes.registerType('victron-input-tank', BaseInputNode)
  RED.nodes.registerType('victron-input-temperature', BaseInputNode)
  RED.nodes.registerType('victron-input-vebus', BaseInputNode)

  // Output nodes
  RED.nodes.registerType('victron-output-accharger', BaseOutputNode)
  RED.nodes.registerType('victron-output-acsystem', BaseOutputNode)
  RED.nodes.registerType('victron-output-battery', BaseOutputNode)
  RED.nodes.registerType('victron-output-charger', BaseOutputNode)
  RED.nodes.registerType('victron-output-custom', BaseOutputNode)
  RED.nodes.registerType('victron-output-dcdc', BaseOutputNode)
  RED.nodes.registerType('victron-output-dess', BaseOutputNode)
  RED.nodes.registerType('victron-output-ess', BaseOutputNode)
  RED.nodes.registerType('victron-output-evcharger', BaseOutputNode)
  RED.nodes.registerType('victron-output-generator', BaseOutputNode)
  RED.nodes.registerType('victron-output-inverter', BaseOutputNode)
  RED.nodes.registerType('victron-output-multi', BaseOutputNode)
  RED.nodes.registerType('victron-output-pump', BaseOutputNode)
  RED.nodes.registerType('victron-output-pvinverter', BaseOutputNode)
  RED.nodes.registerType('victron-output-relay', BaseOutputNode)
  RED.nodes.registerType('victron-output-settings', BaseOutputNode)
  RED.nodes.registerType('victron-output-solarcharger', BaseOutputNode)
  RED.nodes.registerType('victron-output-switch', BaseOutputNode)
  RED.nodes.registerType('victron-output-vebus', BaseOutputNode)
}
