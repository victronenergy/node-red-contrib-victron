'use strict'

const services = require('./victron-services')
const _ = require('lodash')
const packagejson = require('../../package.json');

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
     * Build the edit form layout for a generic input node.
     * Filter the dbus cache for available device services.
     */
    getInputServices(dbusService, device) {

        // filter the dbus cache for battery services
        let devices = _.pickBy(this.cache, (val, key) => key.startsWith(`com.victronenergy.${dbusService}`))

        // construct an object that is used to render the edit form for the node
        return Object.keys(devices).map(dbusInterface => {
            let batteryPaths = devices[dbusInterface]
            let name = batteryPaths['/CustomName'] || batteryPaths['/ProductName'] || dbusInterface

            // the cache is filtered against the desired paths
            // to only show available options per service on the node's edit form.
            let paths = _.get(services.SERVICES, [device, 'paths'], [])
                .filter(p => p && (p.path in batteryPaths))

            return services.INPUT(dbusInterface, name, paths)
        })
 
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

                let relayObject = services.RELAY(service, path, name)

                // Special case for system relay 0 - only allow usage if relay function is set to manual
                if (relayIndex === '0') {
                    const systemRelayFunction = this.cache['com.victronenergy.settings']['/Settings/Relay/Function']
                    if (systemRelayFunction !== 2) { // manual
                        relayObject["disabled"] = true
                        relayObject["warning"] = services.RELAY_MODE_WARNING(services.RELAY_FUNCTIONS[systemRelayFunction])
                    }
                }

                return relayObject
            }
            else {
                // any relay path under a dbus service
                // e.g. battery, inverter ...
                const name = this.cache[service]['/CustomName']
                    || this.cache[service]['/ProductName']
                    || service.split('.').pop()

                return services.RELAY(service, path, name)
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
            }, [])
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
            // input node services
            "digital-input": [
                ...this.getInputServices('pulsemeter', 'Pulse meter'),
                ...this.getInputServices('digitalinput', 'Digital input')
            ],
            "tank": this.getInputServices('tank', 'Tank'),
            "temperature": this.getInputServices('temperature', 'Temperature sensor'),
            "inverter": this.getInputServices('inverter', 'Inverter'),
            "pvinverter": this.getInputServices('pvinverter', 'PV Inverter'),
            "ac-charger": this.getInputServices('charger', 'Charger'),
            "solar-charger": this.getInputServices('solarcharger', 'Solar Charger'),
            "battery": this.getInputServices('battery', 'Battery Monitor'),
            "grid-meter":this.getInputServices('grid', 'Grid Meter'),
            "vebus": this.getInputServices('vebus', 'VE.Bus System'),

            // output services
            "relay": this.getRelayServices(),

            // meta
            "version": _.get(packagejson, 'version')
        }
        return device !== null
            ? services[device]
            : services
    }
}

module.exports = SystemConfiguration
