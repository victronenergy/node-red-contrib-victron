
function setReplacer(key, value) {
    if (typeof value === 'object' && value instanceof Set)
        return [...value];
    return value;
}

module.exports = function(RED) {
    "use strict"

    var VictronClient = require('../services/victronclient.js');

    function VictronClientNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.client = new VictronClient(process.env.NODE_RED_DBUS_ADDRESS);

        this.client.connect()

        // An endpoint for nodes to request services from - returns either a single service, or all available services
        // depending whether the requester gives the service parameter
        RED.httpAdmin.get("/victron/services/:service?", RED.auth.needsPermission('victron-client.read'), function(req, res) {
            let serialized = JSON.stringify(node.client.system.listAvailableServices(req.params.service), setReplacer)
            res.setHeader('Content-Type', 'application/json');
            return res.send(serialized)
        });

    }

    RED.nodes.registerType("victron-client", VictronClientNode);
}
