module.exports = function (RED) {

    const _ = require('lodash')

    class BaseInputNode {
        constructor(nodeDefinition) {
            RED.nodes.createNode(this, nodeDefinition)

            this.node = this

            // this.serviceObj = nodeDefinition.serviceObj
            // this.pathObj = nodeDefinition.pathObj
            this.service = nodeDefinition.service
            this.path = nodeDefinition.path
            // this.initialValue = nodeDefinition.initial


            this.configNode = RED.nodes.getNode("victron-client-id")
            this.client = this.configNode.client

            this.subscription = null

            let handlerId = this.configNode.addStatusListener(this, this.service, this.path)

            if (this.service && this.path) {
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

            // this.serviceObj = nodeDefinition.serviceObj
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
    RED.nodes.registerType('victron-input-digitalinput', BaseInputNode);
    RED.nodes.registerType('victron-input-tank', BaseInputNode);
    RED.nodes.registerType('victron-input-temperature', BaseInputNode);
    RED.nodes.registerType('victron-input-inverter', BaseInputNode);
    RED.nodes.registerType('victron-input-pvinverter', BaseInputNode);
    RED.nodes.registerType('victron-input-accharger', BaseInputNode);
    RED.nodes.registerType('victron-input-solarcharger', BaseInputNode);
    RED.nodes.registerType('victron-input-battery', BaseInputNode);
    RED.nodes.registerType('victron-input-gridmeter', BaseInputNode);
    RED.nodes.registerType('victron-input-vebus', BaseInputNode);
    RED.nodes.registerType('victron-input-gps', BaseInputNode);
    RED.nodes.registerType('victron-input-ess', BaseInputNode);

    // Output nodes
    RED.nodes.registerType('victron-output-vebus', BaseOutputNode);
    RED.nodes.registerType('victron-output-relay', BaseOutputNode);
    RED.nodes.registerType('victron-output-inverter', BaseOutputNode);
    RED.nodes.registerType('victron-output-accharger', BaseOutputNode);
    RED.nodes.registerType('victron-output-solarcharger', BaseOutputNode);
    RED.nodes.registerType('victron-output-ess', BaseOutputNode);
}
