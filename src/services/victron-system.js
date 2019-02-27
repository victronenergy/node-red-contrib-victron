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
     * Build the edit form layout for a generic input/output node.
     * Filter the dbus cache for available device services.
     */
    getServices(dbusService, isOutput = false) {
        // filter the dbus cache for battery services
        let cachedDevices = _.pickBy(this.cache, (val, key) => key.startsWith(`com.victronenergy.${dbusService}`))

        // construct an object that is used to render the edit form for the node
        return Object.keys(cachedDevices).map(dbusInterface => {
            let cachedPaths = cachedDevices[dbusInterface]
            let name = cachedPaths['/CustomName'] || cachedPaths['/ProductName'] || dbusInterface

            // the cache is filtered against the desired paths in services.json
            // to only show available options per service on the node's edit form.
            let paths = _.get(services.SERVICES, [dbusService, 'paths'], [])
                .filter(service =>
                    _.has(cachedPaths, service.path)
                    && (!isOutput || service.writable)) // output paths need a 'writable' property

            return services.TEMPLATE(dbusInterface, name, paths)
        })
    }

    /**
     * Build the edit form for the relay node.
     * Filter the cache for system and battery relays.
     */
    getRelayServices() {
        // Build a relay object representing the relay node settings in node-red UI
        const buildRelayService = (service, paths) => {
            let pathObjects = paths.map(p => {
                const svc = service.split('.')[2] // com.victronenergy.system => system
                let relayObject = _.find(_.get(services.SERVICES, [svc, 'paths']), {path: p});

                // special case for system relay
                if (service.startsWith('com.victronenergy.system') && p.startsWith('/Relay/0')) {
                    const systemRelayFunction = this.cache['com.victronenergy.settings']['/Settings/Relay/Function']
                    if (systemRelayFunction !== 2) { // manual
                        relayObject["disabled"] = true
                        relayObject["warning"] = services.RELAY_MODE_WARNING(services.RELAY_FUNCTIONS[systemRelayFunction])
                    }
                }

                return relayObject
            })

            let name = service.startsWith('com.victronenergy.system')
                ? 'Venus device'
                : this.cache[service]['/CustomName']
                || this.cache[service]['/ProductName']
                || service.split('.').pop()

            return services.TEMPLATE(service, name, pathObjects)

        }

        // Filter all paths that begin with '/Relay'.
        // Construct and return an array of relay nodes representing their settings.
        return Object.entries(this.cache)
            .reduce((acc, [service, pathObj]) => {
                let relayPaths = Object.keys(pathObj).filter(path => path.startsWith('/Relay'))
                if (relayPaths.length)
                    acc.push(buildRelayService(service, relayPaths))
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
    listAvailableServices(device = null) {
        let services = {
            // input node services
            "input-digitalinput": [
                ...this.getServices('pulsemeter'),
                ...this.getServices('digitalinput')
            ],
            "input-tank": this.getServices('tank'),
            "input-temperature": this.getServices('temperature'),
            "input-inverter": this.getServices('inverter'),
            "input-pvinverter": this.getServices('pvinverter'),
            "input-accharger": this.getServices('charger'),
            "input-solarcharger": this.getServices('solarcharger'),
            "input-battery": this.getServices('battery'),
            "input-gridmeter": this.getServices('grid'),
            "input-vebus": this.getServices('vebus'),

            // output services
            "output-relay": this.getRelayServices(),
            "output-vebus": this.getServices('vebus', true),
            "output-inverter": this.getServices('inverter', true),
            "output-accharger": this.getServices('charger', true),
            "output-solarcharger": this.getServices('solarcharger', true),

            // meta
            "version": _.get(packagejson, 'version')
        }
        return device !== null
            ? services[device]
            : services
    }
}

module.exports = SystemConfiguration
