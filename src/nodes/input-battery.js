
module.exports = function(RED) {
    "use strict";

    function InputBattery(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.service = config.service //JSON.parse(config.service);
        this.path = config.path //JSON.parse(config.path)

        this.subscription = null;
        this.config = RED.nodes.getNode("victron-client-id");
        this.client = this.config.client;
        
        let availableServices = this.client.system.listAvailableServices('battery'); // TODO: remove (?)

        if (availableServices && this.service) {
            this.subscription = this.client.subscribe(this.service, this.path, (msg) => {
                node.send({
                    payload: msg.value,
                    topic: `${this.service} - ${this.path}`
                });
            });
        }

        this.on('close', function(done) {
            node.client.unsubscribe(node.subscription);

             // This works, unsubscribe doesn't seem to.
             // unsubscribe probably isn't even needed, since everything gets restarted on deploy anyways
             // TODO
            node.client.subscriptions = {}
            done();
        });

    }

    RED.nodes.registerType("victron-battery", InputBattery);
}
