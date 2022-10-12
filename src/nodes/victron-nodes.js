module.exports = function (RED) {

    const _ = require('lodash')
    const debug = require('debug')('node-red-contrib-victron:victron-client')

    const migrateSubscriptions = (x) => {
        var deviceInstance = ''
        const services = x.client.client.services
        for (var key in services) {
            if (services[key].name === x.service) {
                deviceInstance = services[key].deviceInstance || ''
                break
            }
        }
        if (deviceInstance) {
            var dbusInterface = x.service.split('.').splice(0,3).join('.')+('.'+deviceInstance).replace(/\.$/, '')
            var newsub = dbusInterface+x.path
            var oldsub = x.service+x.path
            if (x.client.subscriptions[oldsub]) {
              debug(`Migrating subscription from ${oldsub} to ${newsub} (please update your flow)`)
              x.service = dbusInterface
              x.client.subscriptions[newsub] = x.client.subscriptions[oldsub]
              x.client.subscriptions[newsub][0].dbusInterface = dbusInterface
              delete x.client.subscriptions[oldsub]
           }
        }
    }

    class BaseInputNode {
        constructor(nodeDefinition) {
            RED.nodes.createNode(this, nodeDefinition)

            this.node = this

            this.service = nodeDefinition.service
            this.path = nodeDefinition.path

            this.configNode = RED.nodes.getNode("victron-client-id")
            this.client = this.configNode.client

            this.subscription = null

            let handlerId = this.configNode.addStatusListener(this, this.service, this.path)

            if (this.service && this.path) {
                // The following is for migration purposes:
                // we used to store the full path of the servicepath instead of the first
                // 3 parts + optional deviceinstance.
                var device = this.service.split('.')[3]
                if ( device && ! device.match(/^\d+$/) ) {
                    this.client.client.getValue(this.service, '/DeviceInstance')
                    setTimeout(migrateSubscriptions, 1000, this)
                }

                this.subscription = this.client.subscribe(this.service, this.path, (msg) => {
                    this.node.send({
                        payload: msg.value,
                        topic: `${this.service} - ${this.path}`
                    })
                })
            }

            this.on('close', function (done) {
                this.node.client.unsubscribe(this.node.subscription)
                this.node.configNode.removeStatusListener(handlerId)
                done()
            })
        }
    }

    class BaseOutputNode {
        constructor(nodeDefinition) {
            RED.nodes.createNode(this, nodeDefinition)

            this.node = this

            this.pathObj = nodeDefinition.pathObj
            this.service = nodeDefinition.service
            this.path = nodeDefinition.path
            this.initialValue = nodeDefinition.initial

            this.configNode = RED.nodes.getNode("victron-client-id")
            this.client = this.configNode.client

            let handlerId = this.configNode.addStatusListener(this, this.service, this.path)

            const setValue = (value) => {
                if (!this.pathObj.disabled && this.service && this.path)
                    this.client.publish(this.service, this.path, value)
            }

            if (this.initialValue)
                setValue(parseInt(this.initialValue))

            this.on("input", function (msg) {
                setValue(msg.payload)
            });

            this.on('close', function (done) {
                this.node.configNode.removeStatusListener(handlerId)
                done()
            })
        }
    }

    // Input nodes
    RED.nodes.registerType('victron-input-accharger', BaseInputNode);
    RED.nodes.registerType('victron-input-acload', BaseInputNode);
    RED.nodes.registerType('victron-input-alternator', BaseInputNode);
    RED.nodes.registerType('victron-input-battery', BaseInputNode);
    RED.nodes.registerType('victron-input-dcload', BaseInputNode);
    RED.nodes.registerType('victron-input-dcsource', BaseInputNode);
    RED.nodes.registerType('victron-input-dcsystem', BaseInputNode);
    RED.nodes.registerType('victron-input-digitalinput', BaseInputNode);
    RED.nodes.registerType('victron-input-ess', BaseInputNode);
    RED.nodes.registerType('victron-input-evcharger', BaseInputNode);
    RED.nodes.registerType('victron-input-fuelcell', BaseInputNode);
    RED.nodes.registerType('victron-input-generator', BaseInputNode);
    RED.nodes.registerType('victron-input-genset', BaseInputNode);
    RED.nodes.registerType('victron-input-gps', BaseInputNode);
    RED.nodes.registerType('victron-input-gridmeter', BaseInputNode);
    RED.nodes.registerType('victron-input-inverter', BaseInputNode);
    RED.nodes.registerType('victron-input-meteo', BaseInputNode);
    RED.nodes.registerType('victron-input-motordrive', BaseInputNode);
    RED.nodes.registerType('victron-input-multi', BaseInputNode);
    RED.nodes.registerType('victron-input-pulsemeter', BaseInputNode);
    RED.nodes.registerType('victron-input-pvinverter', BaseInputNode);
    RED.nodes.registerType('victron-input-relay', BaseInputNode);
    RED.nodes.registerType('victron-input-settings', BaseInputNode);
    RED.nodes.registerType('victron-input-solarcharger', BaseInputNode);
    RED.nodes.registerType('victron-input-system', BaseInputNode);
    RED.nodes.registerType('victron-input-tank', BaseInputNode);
    RED.nodes.registerType('victron-input-temperature', BaseInputNode);
    RED.nodes.registerType('victron-input-vebus', BaseInputNode);

    // Output nodes
    RED.nodes.registerType('victron-output-accharger', BaseOutputNode);
    RED.nodes.registerType('victron-output-charger', BaseOutputNode);
    RED.nodes.registerType('victron-output-ess', BaseOutputNode);
    RED.nodes.registerType('victron-output-evcharger', BaseOutputNode);
    RED.nodes.registerType('victron-output-generator', BaseOutputNode);
    RED.nodes.registerType('victron-output-inverter', BaseOutputNode);
    RED.nodes.registerType('victron-output-multi', BaseOutputNode);
    RED.nodes.registerType('victron-output-pvinverter', BaseOutputNode);
    RED.nodes.registerType('victron-output-relay', BaseOutputNode);
    RED.nodes.registerType('victron-output-settings', BaseOutputNode);
    RED.nodes.registerType('victron-output-solarcharger', BaseOutputNode);
    RED.nodes.registerType('victron-output-vebus', BaseOutputNode);
}
