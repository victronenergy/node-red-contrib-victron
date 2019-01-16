'use strict';

const mapping = require('./servicemapping');
const _ = require('lodash')
const debug = require('debug')('node-red-contrib-victron:systemconfiguartion')

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
     * Build the edit form layout for the battery node.
     * Filter the dbus cache for available battery services.
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
     * Build the edit form for the relay node.
     * Filter the cache for system and battery relays.
     */
    getRelayServices() {

        // Build a relay object representing the relay node settings in node-red UI
        const buildRelayObject = (service, path) => {
            if (service.startsWith('com.victronenergy.system')) {
                const relayIndex = path.split('/')[2] || ''
                const name = `Venus device (${relayIndex})`

                let relayObject = mapping.RELAY(service, path, name)

                // Special case for system relay 0 - only allow usage if relay function is set to manual
                if (relayIndex === '0') {
                    const systemRelayFunction = this.cache['com.victronenergy.settings']['/Settings/Relay/Function']
                    if (systemRelayFunction !== 2) { // manual
                        relayObject["disabled"] = true
                        relayObject["warning"] = mapping.RELAY_MODE_WARNING(mapping.RELAY_FUNCTIONS[systemRelayFunction])
                    }
                }

                return relayObject
            }
            if (service.startsWith('com.victronenergy.battery')) {
                const name = this.cache[service]['/CustomName']
                    || this.cache[service]['/ProductName']
                    || service.split('.').pop()

                return mapping.RELAY(service, path, name)
            }
        }

        // Filter all paths that begin with '/Relay'.
        // Construct and return an array of relay nodes representing their settings.
        return Object.entries(this.cache)
            .reduce((acc, [service, pathObj]) => {
                Object.keys(pathObj)
                    .filter(path => path.startsWith('/Relay'))
                    .map(relayPath => acc.push(
                        buildRelayObject(service, relayPath))
                    )
                return acc
            }, []);
    }

    /**
     * List all currently available services. This list is used to populate the nodes' edit dialog.
     * E.g. if a battery monitor is available, all the given battery monitor services are listed
     * in the input-battery node.
     * 
     * @param {string} service an optional parameter to filter available services based on the given device
     */
    listAvailableServices(device=null) {
        let services = {
            "battery": this.getBatteryServices(),
            "relay": this.getRelayServices(),
            "cache": this.cache
        };

        return device !== null
            ? services[device]
            : services;
    }

}

module.exports = SystemConfiguration;
