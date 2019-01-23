/**
 * Victron Energy relay node
 */
module.exports = function(RED) {
    "use strict"

    const services = require('../services/victron-services')
    const _ = require('lodash')

    function OutputRelay(config) {
        RED.nodes.createNode(this, config)
        let _this = this

        this.serviceObj = config.service
        this.service = _.get(config.service, 'service')
        this.path = _.get(config.service, 'paths[0].path')

        this.state = config.state

        this.config = RED.nodes.getNode("victron-client-id")
        this.client = this.config.client

        let handlerId = this.config.addStatusListener(this, this.service, this.path)

        let stateToMessage = (state, previousState) => {
            switch(state) {
                case 'on':
                    return 1
                case 'off':
                    return 0
                case 'toggle':
                    return 1 - parseInt(previousState)
            }
        }

        this.on("input", function(msg) {
            if (!_.has(this.serviceObj, 'disabled')) {
                const previousState = _.get(this.client, ['system', 'cache', this.service, this.path], 0) // defaults to 0
                const newState = stateToMessage(this.state, previousState)
                this.client.publish(this.service, this.path, newState)
            }
            else
                this.warn(services.RELAY_MODE_WARNING('another'))
        });

        this.on('close', function(done) {
            _this.config.removeStatusListener(handlerId)
            done()
        })

    }

    RED.nodes.registerType("victron-relay", OutputRelay)
}
