
module.exports = function(RED) {
    "use strict";

    function OutputRelay(config) {
        RED.nodes.createNode(this, config);

        this.service = config.service //TODO: remove JSON.parse(config.service);
        this.state = config.state;
        this.config = RED.nodes.getNode("victron-client-id");
        this.client = this.config.client;

        let toggleState = 0;

        let stateToMessage = state => {
            switch(state) {
                case 'on':
                    return 1;
                case 'off':
                    return 0;
                case 'toggle':
                    // Ideally the initial state would be fetched from the relay itself
                    toggleState = 1 - toggleState;
                    return toggleState;
            }
        };
        
        this.on("input", function(msg) {
            // TODO: add interface selection via UI
            // this.service => this.path
            this.client.publish("com.victronenergy.system", this.service, stateToMessage(this.state));
        });

    }

    RED.nodes.registerType("victron-relay", OutputRelay);
}
