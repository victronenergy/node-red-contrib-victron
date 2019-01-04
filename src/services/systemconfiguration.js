'use strict';

const svc = require('./servicemapping');

/**
 * SystemConfiguration contains information on the given Venus system.
 * It acts as a cache for available services based on what messages
 * it receives from the dbus-listener
 */
class SystemConfiguration {
    constructor() {       
        // keeps a dynamically filled list of discovered dbus services
        // currently, the system does not detect a disappearing service
        this.devices = {};
    }

    /**
     * a callback that should be called on each received dbus message
     * in order to maintain a list of available devices on the dbus.
     * 
     * @param {object} msg a message object received from the dbus-listener
     */
    serviceDiscoveryCallback(msg) {
        let dbusInterface = this.devices[msg.senderName] || new Set();
        this.devices[msg.senderName] = dbusInterface.add(msg.path);
    }

    /**
     * A helper method to capture services from a dbus listing.
     * 
     * @param {string} regex a regular expression with a capture group
     * @param {array} devices an array of strings
     */
    matchAndCapture(regex, devices) {
        // combine to a single string to execute regex only once
        let match;
        let matches = [];

        while (match = regex.exec(devices.join('\n'))) {
            matches.push(match[1])
        }

        return matches;
    }

    getBatteryServices() {
        // parses all the dbus interfaces for batteries: com.victronenergy.battery.<id>
        const re = /\bcom\.victronenergy\.battery\.(.*)/g;
        
        let dbusInterfaces = [...Object.keys(this.devices)];
        let batteries = this.matchAndCapture(re, dbusInterfaces);
        
        let services = [];
        batteries.forEach(battery => {
            services.push({
                ...svc.BATTERY,
                "service": `com.victronenergy.battery.${battery}`,
                "name": battery
            })
        });

        return services;
    }

    getRelayServices() {
        // parses all /Relay/<id>/State paths
        const re = /\/Relay\/(\d)+\/State/g;

        let systemPaths = this.devices["com.victronenergy.system"] || [];
        let relays = this.matchAndCapture(re, [...systemPaths]);

        let services = [];
        relays.forEach(r => {
            let relayService = {...svc.RELAY}
            
            relayService.name = `Relay ${r}`
            relayService.paths = [{
                "label": "State (on/off)",
                "path": `/Relay/${r}/State`
            }]

            //relayService.paths[0].path = `/Relay/${r}/State`; // TODO: why doesn't this work?

            services.push(relayService)

        });

        return services;
    }

    /**
     * Lists all currently available services. This list is used to populate the nodes' edit dialog.
     * E.g. if a battery monitor is available, all the given battery monitor services are listed
     * in the input-battery node.
     * 
     * @param {string} service an optional parameter to filter available services based on the given device
     */
    listAvailableServices(device=null) {
        let services = {
            "battery": this.getBatteryServices(),
            "relay": this.getRelayServices(),
            //"all": this.devices
        };

        return device !== null
            ? services[device]
            : services;
    }

}

module.exports = SystemConfiguration;
