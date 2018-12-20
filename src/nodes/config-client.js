
module.exports = function(RED) {
    "use strict"

    var VictronClient = require('../services/victronclient.js');

    function VictronClientNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        // ip defaults to localhost if empty
        this.client = new VictronClient(process.env.NODE_RED_DBUS_ADDRESS);
        this.connected = false;

        this.client.connect().then(() => {
            this.connected = true;
        });

        // An endpoint for nodes to request services from - returns either a single service, or all available services
        // depending whether the requester gives the service parameter
        RED.httpAdmin.get("/victron/services/:service?", RED.auth.needsPermission('victron-client.read'), function(req, res) {
            return res.json(node.client.system.listAvailableServices(req.params.service))
        });

    }

    RED.nodes.registerType("victron-client", VictronClientNode);
}
