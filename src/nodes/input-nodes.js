module.exports = function(RED) {

    const _ = require('lodash')

    class BaseInputNode {
        constructor(nodeDefinition) {
            RED.nodes.createNode(this, nodeDefinition)

            this.node = this

            this.service = _.get(nodeDefinition.service, 'service')
            this.path = nodeDefinition.path

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

            this.on('close', function(done) {
                this.node.client.unsubscribe(this.node.subscription)
                this.node.configNode.removeStatusListener(handlerId)
                done()
            })
        }
    }

    RED.nodes.registerType('victron-digital-input', BaseInputNode);
    RED.nodes.registerType('victron-tank', BaseInputNode);
    RED.nodes.registerType('victron-temperature', BaseInputNode);
    RED.nodes.registerType('victron-inverter', BaseInputNode);
    RED.nodes.registerType('victron-pvinverter', BaseInputNode);
    RED.nodes.registerType('victron-ac-charger', BaseInputNode);
    RED.nodes.registerType('victron-solar-charger', BaseInputNode);
    RED.nodes.registerType('victron-battery', BaseInputNode);
    RED.nodes.registerType('victron-grid-meter', BaseInputNode);
    RED.nodes.registerType('victron-vebus', BaseInputNode);

}
