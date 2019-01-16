
module.exports = function(RED) {
    "use strict";

    const mapping = require('../services/servicemapping');

    function OutputRelay(config) {
        RED.nodes.createNode(this, config)

        this.service = JSON.parse(config.service)
        this.state = config.state
        this.config = RED.nodes.getNode("victron-client-id")
        this.client = this.config.client

        let toggleState = 0

        let stateToMessage = state => {
            switch(state) {
                case 'on':
                    return 1
                case 'off':
                    return 0
                case 'toggle':
                    toggleState = 1 - toggleState
                    return toggleState
            }
        };

        this.on("input", function(msg) {
            let path = this.service.paths[0].path
            let service = this.service.service

            if (!this.service.disabled)
                this.client.publish(service, path, stateToMessage(this.state))
            else
                this.warn(mapping.RELAY_MODE_WARNING('another'))
        });

    }

    RED.nodes.registerType("victron-relay", OutputRelay)
}
