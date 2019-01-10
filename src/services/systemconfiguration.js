'use strict';

const mapping = require('./servicemapping');
const _ = require('lodash')
const debug = require('debug')('node-red-contrib-victron:systemconfiguration')

/**
 * SystemConfiguration contains information on the given Venus system.
 * It acts as a cache for available services based on what messages
 * it receives from the dbus-listener
 */
class SystemConfiguration {
    constructor() {
        // keeps a dynamically filled list of discovered dbus services
        // The system does not detect a disappearing service
        this.cache = {}
    }

    /**
     * Builds the edit form layout for the battery node.
     * Filters the dbus cache for available battery services.
     */
    getBatteryServices() {
        // filter the dbus cache for battery services
        let batteries = _.pickBy(this.cache, (val, key) => key.startsWith('com.victronenergy.battery'))

        // construct an object that is used to render the edit form for the node
        return Object.keys(batteries).map(dbusInterface => {
            let batteryPaths = batteries[dbusInterface]
            let name = batteryPaths['/CustomName'] || batteryPaths['/ProductName'] || dbusInterface

            // the cache is filtered against the desired paths
            // to only show available options per service on the node's edit form.
            let paths = mapping.BATTERY_PATHS.filter(p => {
                return p.path in batteryPaths
            })

            return mapping.BATTERY(dbusInterface, name, paths)
        });

    }
    /**
     * Builds the edit form for the relay node.
     * Filters the cache for system and battery relays.
     */
    getRelayServices() {
        // Iterate over previously found devices and look for /Relay/X paths
        let services = [];
        Object.keys(this.cache).forEach(svc => {
            Object.keys(this.cache[svc]).forEach(path => {
                if (_.startsWith(path, '/Relay')) {

                    // Node label is based on the given service
                    let name = ''
                    if (_.startsWith(svc, 'com.victronenergy.battery')) {
                        let batteryRe = /\bbattery\.(.*)/
                        let batterySvc = batteryRe.exec(svc)

                        name = this.cache[svc]['/CustomName'] || this.cache[svc]['/ProductName'] || batterySvc[1]
                    }
                    else if (_.startsWith(svc, 'com.victronenergy.system')) {
                        let relayPathRe = /\/Relay\/(\d)+\/State/
                        let systemRelayIdx = relayPathRe.exec(path)
                        name = systemRelayIdx !== null ? `Venus device (${systemRelayIdx[1]})` : ''
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
