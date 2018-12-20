
module.exports = function(RED) {
    "use strict";

    function InputBattery(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.service = JSON.parse(config.service);
        this.subscription = null;
        this.config = RED.nodes.getNode("victron-client-id");
        this.client = this.config.client;
        
        let availableServices = this.client.system.listAvailableServices('battery');

        if (availableServices && this.service) {
            let serviceId = this.service.serviceId;
            this.subscription = this.client.subscribeService(serviceId, (msg) => {
                node.send({
                    payload: msg.value,
                    topic: `${this.service.service} - ${this.service.path}`
                });
            });
        }

        this.on('close', function(done) {
            node.client.unsubscribe(node.subscription);
            done();
        });

    }

    RED.nodes.registerType("victron-battery", InputBattery);
}
