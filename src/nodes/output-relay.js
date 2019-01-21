
module.exports = function(RED) {
    "use strict";

    const mapping = require('../services/servicemapping');

    function OutputRelay(config) {
        RED.nodes.createNode(this, config)

        this.service = config.service
        this.state = config.state

        this.config = RED.nodes.getNode("victron-client-id")
        this.client = this.config.client

        let stateToMessage = (state, previousState) => {
            switch(state) {
                case 'on':
                    return 1
                case 'off':
                    return 0
                case 'toggle':
                    return 1 - parseInt(previousState)
            }
        };

        this.on("input", function(msg) {
            const path = this.service.paths[0].path
            const service = this.service.service
            const previousState = this.client.system.cache[service][path]

            if (!this.service.disabled)
                this.client.publish(service, path, stateToMessage(this.state, previousState))
            else
                this.warn(mapping.RELAY_MODE_WARNING('another'))
        });

    }

    RED.nodes.registerType("victron-relay", OutputRelay)
}
