/**
 * Victron Energy battery node
 */
module.exports = function(RED) {
    "use strict"

    const _ = require('lodash')

    function InputBattery(config) {
        RED.nodes.createNode(this, config)
        let _this = this

        this.service = _.get(config.service, 'service')
        this.path = config.path

        this.subscription = null
        this.config = RED.nodes.getNode("victron-client-id")
        this.client = this.config.client


        let handlerId = this.config.addStatusListener(this, this.service, this.path)

        if (this.service && this.path) {
            this.subscription = this.client.subscribe(this.service, this.path, (msg) => {
                _this.send({
                    payload: msg.value,
                    topic: `${this.service} - ${this.path}`
                })
            })
        }

        this.on('close', function(done) {
            _this.client.unsubscribe(_this.subscription)
            _this.config.removeStatusListener(handlerId)
            done()
        })

    }

    RED.nodes.registerType("victron-battery", InputBattery)
}
