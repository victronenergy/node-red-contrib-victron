
module.exports = function(RED) {
    "use strict";

    function InputBattery(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.service = JSON.parse(config.service);
        this.path = JSON.parse(config.path);

        this.subscription = null;
        this.config = RED.nodes.getNode("victron-client-id");
        this.client = this.config.client;

        if (this.service && this.path) {
            this.subscription = this.client.subscribe(this.service.service, this.path.path, (msg) => {
                node.send({
                    payload: msg.value,
                    topic: `${this.service.service} - ${this.path.path}`
                });
            });
        }

        this.on('close', function(done) {
            node.client.unsubscribe(node.subscription);
            node.client.subscriptions = {}
            done();
        });

    }

    RED.nodes.registerType("victron-battery", InputBattery);
}
