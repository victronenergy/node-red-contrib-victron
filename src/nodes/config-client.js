
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

        // ip defaults to localhost if empty
        let [dbusAddress, dbusPort] = process.env.NODE_RED_DBUS_ADDRESS.split(':')
        this.client = new VictronClient(dbusAddress, dbusPort);
        this.connected = false;

        this.client.connect().then(() => {
            this.connected = true;
        });

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
