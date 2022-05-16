'use strict'

const utils = require('./utils.js')
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
        this.cache = {}
    }

    /**
     * Build the edit form layout for a generic input/output node.
     * Filter the dbus cache for available device services.
     */
    getNodeServices(nodeName) {
        const servicesWhitelist = _.get(utils.SERVICES, [nodeName])
        const isOutput = nodeName.startsWith('output')

        return Object.entries(servicesWhitelist)
            .reduce((acc, [dbusService, servicePaths]) => {
                // get the already cached dbus paths
                let cachedService = _.pickBy(this.cache, (val, key) => key.startsWith(`com.victronenergy.${dbusService}`))

                // construct an object that is used to render the edit form for the node
                Object.keys(cachedService).forEach((dbusInterface) => {
                    let cachedPaths = cachedService[dbusInterface]
                    let name = cachedPaths['/CustomName']
                        || cachedPaths['/ProductName']
                        || _.get(utils.DEFAULT_SERVICE_NAMES, [nodeName, dbusService], dbusInterface)

                    // the cache is filtered against the desired paths in services.json
                    // to only show available options per service on the node's edit form.

                    let paths = servicePaths.filter(pathObj =>
                        pathObj
                        && _.has(cachedPaths, pathObj.path)
                        && (!isOutput || (pathObj.writable // output nodes need a writable property
                            // if the path has corresponding /*isAdjustable path for the service, check their value
                            // If no /*isAdjustable path is present, default to showing the path
                            && (pathObj.path !== '/Mode' || _.get(cachedPaths, '/ModeIsAdjustable', 1)) // vebus
                            && (pathObj.path !== '/Ac/In/1/CurrentLimit' || _.get(cachedPaths, '/Ac/In/1/CurrentLimitIsAdjustable', 1)) // vebus
                            && (pathObj.path !== '/Ac/In/2/CurrentLimit' || _.get(cachedPaths, '/Ac/In/2/CurrentLimitIsAdjustable', 1)) // vebus
                        )
                        )
                    )

                    // Only show the service if it actually has paths available
                    if (paths.length)
                        acc.push(utils.TEMPLATE(dbusInterface, name, paths))
                })
                return acc
            }, [])
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

                let relayObject = _.find(_.get(utils.SERVICES, ['output-relay', svc]), { path: p })

                if (!relayObject)
                    console.error(`A relay path specification '${p}' is missing in services.json for service ${svc}.`)

                // special case for system relay
                if (relayObject && service.startsWith('com.victronenergy.system') && p.startsWith('/Relay/0')) {
                    const systemRelayFunction = this.cache['com.victronenergy.settings']['/Settings/Relay/Function']
                    if (systemRelayFunction !== 2) { // manual
                        relayObject["disabled"] = true
                        relayObject["warning"] = utils.RELAY_MODE_WARNING(utils.RELAY_FUNCTIONS[systemRelayFunction])
                    } else {
                       delete(relayObject["warning"])
                    }
                }
                return relayObject
            })

            let name = service.startsWith('com.victronenergy.system')
                ? 'Venus device'
                : this.cache[service]['/CustomName']
                || this.cache[service]['/ProductName']
                || service.split('.').pop()

            return utils.TEMPLATE(service, name, pathObjects)

        }

        // Filter all paths that begin with '/Relay'.
        // Construct and return an array of relay nodes representing their settings.
        return Object.entries(this.cache)
            .reduce((acc, [service, pathObj]) => {
                let relayPaths = Object.keys(pathObj).filter(path => path.startsWith('/Relay'))
                if (relayPaths.length) {
                    const relaySvc = buildRelayService(service, relayPaths)
                    // add the relay service if svc.paths has actually non-nullible values
                    // (e.g. paths: [null, null] is not acceptable)
                    if (relaySvc.paths.filter(p => p).length > 0) acc.push(relaySvc)
                }
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
            // meta
            "version": _.get(packagejson, 'version'),

            // input node services
            "input-accharger": this.getNodeServices("input-accharger"),
            "input-acload": this.getNodeServices("input-acload"),
            "input-alternator": this.getNodeServices("input-alternator"),
            "input-battery": this.getNodeServices("input-battery"),
            "input-dcdc": this.getNodeServices("input-dcdc"),
            "input-dcload": this.getNodeServices("input-dcload"),
            "input-dcsource": this.getNodeServices("input-dcsource"),
            "input-dcsystem": this.getNodeServices("input-dcsystem"),
            "input-digitalinput": this.getNodeServices("input-digitalinput"),
            "input-ess": this.getNodeServices("input-ess"),
            "input-evcharger": this.getNodeServices("input-evcharger"),
            "input-fuelcell": this.getNodeServices("input-fuelcell"),
            "input-generator": this.getNodeServices("input-generator"),
            "input-genset": this.getNodeServices("input-genset"),
            "input-gps": this.getNodeServices("input-gps"),
            "input-gridmeter": this.getNodeServices("input-gridmeter"),
            "input-inverter": this.getNodeServices("input-inverter"),
            "input-meteo": this.getNodeServices("input-meteo"),
            "input-multi": this.getNodeServices("input-multi"),
            "input-pulsemeter": this.getNodeServices("input-pulsemeter"),
            "input-pvinverter": this.getNodeServices("input-pvinverter"),
            "input-relay": this.getNodeServices("input-relay"),
            "input-solarcharger": this.getNodeServices("input-solarcharger"),
            "input-system": this.getNodeServices("input-system"),
            "input-tank": this.getNodeServices("input-tank"),
            "input-temperature": this.getNodeServices("input-temperature"),
            "input-vebus": this.getNodeServices("input-vebus"),

            // output services
            "output-accharger": this.getNodeServices("output-accharger"),
            "output-ess": this.getNodeServices("output-ess"),
            "output-evcharger": this.getNodeServices("output-evcharger"),
            "output-generator": this.getNodeServices("output-generator"),
            "output-inverter": this.getNodeServices("output-inverter"),
            "output-multi": this.getNodeServices("output-multi"),
            "output-pvinverter": this.getNodeServices("output-pvinverter"),
            "output-relay": this.getRelayServices(),
            "output-settings": this.getNodeServices("output-settings"),
            "output-solarcharger": this.getNodeServices("output-solarcharger"),
            "output-vebus": this.getNodeServices("output-vebus"),
        }

        return device !== null
            ? services[device]
            : services
    }
}

module.exports = SystemConfiguration
