module.exports = function (RED) {
  const debug = require('debug')('node-red-contrib-victron:victron-client')
  const utils = require('../services/utils.js')

  const migrateSubscriptions = (x) => {
    const services = x.client.client.services
    for (const key in services) {
      if (services[key].name === x.service) {
        x.deviceInstance = services[key].deviceInstance
        break
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
          this.client.client.getValue(this.service, '/DeviceInstance')
          setTimeout(migrateSubscriptions, 1000, this)
        }

        this.subscription = this.client.subscribe(this.service, this.path, (msg) => {
          let topic = this.defaulttopic
          if (this.node.name) {
            topic = this.node.name
          }
          if (this.node.onlyChanges && !msg.changed && this.sentInitialValue) {
            return
          }
          if ((Number(this.node.roundValues) >= 0) && (typeof (msg.value) === 'number')) {
            msg.value = +msg.value.toFixed(this.node.roundValues)
          }
          if (this.node.onlyChanges && this.node.previousvalue === msg.value) {
            return
          }
          this.node.previousvalue = msg.value
          this.node.send({
            payload: msg.value,
            topic
          })
          if (this.configNode && this.configNode.showValues) {
            this.node.status({ fill: 'green', shape: 'dot', text: msg.value })
          }
          if (!this.sentInitialValue) {
            this.sentInitialValue = true
          }
        })
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
      this.initialValue = nodeDefinition.initial

      this.configNode = RED.nodes.getNode('victron-client-id')
      this.client = this.configNode.client

      const handlerId = this.configNode.addStatusListener(this, this.service, this.path)

      const setValue = (value, path) => {
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
          this.client.publish(this.service, writepath, value)
          if (this.configNode && this.configNode.showValues) {
            this.node.status({ fill: 'green', shape, text: value })
          }
        }
      }

      if (this.initialValue) { setValue(parseInt(this.initialValue)) }

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
  RED.nodes.registerType('victron-input-alternator', BaseInputNode)
  RED.nodes.registerType('victron-input-battery', BaseInputNode)
  RED.nodes.registerType('victron-input-custom', BaseInputNode)
  RED.nodes.registerType('victron-input-dcload', BaseInputNode)
  RED.nodes.registerType('victron-input-dcsource', BaseInputNode)
  RED.nodes.registerType('victron-input-dcsystem', BaseInputNode)
  RED.nodes.registerType('victron-input-digitalinput', BaseInputNode)
  RED.nodes.registerType('victron-input-ess', BaseInputNode)
  RED.nodes.registerType('victron-input-evcharger', BaseInputNode)
  RED.nodes.registerType('victron-input-fuelcell', BaseInputNode)
  RED.nodes.registerType('victron-input-generator', BaseInputNode)
  RED.nodes.registerType('victron-input-genset', BaseInputNode)
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
  RED.nodes.registerType('victron-input-system', BaseInputNode)
  RED.nodes.registerType('victron-input-tank', BaseInputNode)
  RED.nodes.registerType('victron-input-temperature', BaseInputNode)
  RED.nodes.registerType('victron-input-vebus', BaseInputNode)

  // Output nodes
  RED.nodes.registerType('victron-output-accharger', BaseOutputNode)
  RED.nodes.registerType('victron-output-battery', BaseOutputNode)
  RED.nodes.registerType('victron-output-charger', BaseOutputNode)
  RED.nodes.registerType('victron-output-custom', BaseOutputNode)
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
  RED.nodes.registerType('victron-output-vebus', BaseOutputNode)
}
