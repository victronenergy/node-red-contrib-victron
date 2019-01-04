'use strict';

const mapping = require('./servicemapping');
const _ = require('lodash')

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

    captureOne(regex, str) {
        while (match = regex.exec(str)) {}
        return match[1]
    }

    getBatteryServices() {
        // parses all the dbus interfaces for batteries: com.victronenergy.battery.<id>
        const re = /\bcom\.victronenergy\.battery\.(.*)/g;
        
        let dbusInterfaces = [...Object.keys(this.devices)];
        let batteries = this.matchAndCapture(re, dbusInterfaces);
        
        let services = [];
        batteries.forEach(battery => {
            services.push(
                mapping.BATTERY(`com.victronenergy.battery.${battery}`, battery)
            )
        });

        return services;
    }

    getRelayServices() {
        // Iterate over previously found devices and look for /Relay/X paths
        let services = []
        Object.keys(this.devices).forEach(svc => {
            this.devices[svc].forEach(path => {
                if (_.startsWith(path, '/Relay')) {

                    // Node label is based on the given service
                    let name = ''
                    if (_.startsWith(svc, 'com.victronenergy.battery')) {
                        let batteryRe = /\bbattery\.(.*)/
                        let batterySvc = batteryRe.exec(svc)
                        name = batterySvc !== null ? `Battery (${batterySvc[1]})` : ''
                    }
                    else if (_.startsWith(svc, 'com.victronenergy.system')) {
                        let relayPathRe = /\/Relay\/(\d)+\/State/
                        let systemRelayIdx = relayPathRe.exec(path)
                        name = systemRelayIdx !== null ? `System (${systemRelayIdx[1]})` : ''
                    }

                    services.push(mapping.RELAY(svc, path, name))
                }
            })
        })

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
            "relay": this.getRelayServices()
        };

        return device !== null
            ? services[device]
            : services;
    }

}

module.exports = SystemConfiguration;
