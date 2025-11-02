'use strict'

const utils = require('./utils.js')
const _ = require('lodash')
const packagejson = require('../../package.json')

/**
 * SystemConfiguration contains information on the given Venus system.
 * It acts as a cache for available services based on what messages
 * it receives from the dbus-listener
 */
class SystemConfiguration {
  constructor () {
    // keeps a dynamically filled list of discovered dbus services
    this.cache = {}
  }

  /**
     * Build the edit form layout for a generic input/output node.
     * Filter the dbus cache for available device services.
     */
  getNodeServices (nodeName) {
    const servicesWhitelist = _.get(utils.SERVICES, [nodeName.replace(/^(input-|output-)/g, '')])
    const isOutput = nodeName.startsWith('output')

    return Object.entries(servicesWhitelist || {})
      .reduce((acc, [dbusService, servicePaths]) => {
        const cachedService = _.pickBy(this.cache, (val, key) => key.startsWith(`com.victronenergy.${dbusService}`))

        Object.keys(cachedService).forEach((dbusInterface) => {
          const cachedPaths = cachedService[dbusInterface]
          let name = cachedPaths['/CustomName'] ||
                        cachedPaths['/ProductName'] ||
                        _.get(utils.DEFAULT_SERVICE_NAMES, [nodeName, dbusService], dbusInterface)

          if (dbusInterface.startsWith('com.victronenergy.system')) {
            name = 'Venus system'
          }
          if (dbusInterface.startsWith('com.victronenergy.settings')) {
            name = 'Venus settings'
          }

          const expandedPaths = servicePaths.reduce((pathAcc, pathObj) => {
            if (!pathObj) return pathAcc

            const expanded = utils.expandWildcardPaths(pathObj, cachedPaths, dbusService)

            const filtered = expanded.filter(expandedPathObj =>
              (!isOutput || (
                (expandedPathObj.path !== '/Mode' || _.get(cachedPaths, '/ModeIsAdjustable', 1)) &&
                (expandedPathObj.path !== '/Ac/In/1/CurrentLimit' || _.get(cachedPaths, '/Ac/In/1/CurrentLimitIsAdjustable', 1)) &&
                (expandedPathObj.path !== '/Ac/In/2/CurrentLimit' || _.get(cachedPaths, '/Ac/In/2/CurrentLimitIsAdjustable', 1))
              )) &&
              (expandedPathObj.mode === 'both' ||
              (isOutput && expandedPathObj.mode === 'output') ||
              (!isOutput && (expandedPathObj.mode === 'input' || !expandedPathObj.mode)))
            )

            return pathAcc.concat(filtered)
          }, [])

          expandedPaths.sort((a, b) => a.name > b.name ? 1 : -1)

          const deviceInstance = cachedPaths['/DeviceInstance'] || ''
          if (expandedPaths.length) {
            acc.push(utils.TEMPLATE(dbusInterface, name, deviceInstance, expandedPaths))
          }
        })
        return acc
      }, [])
  }

  /**
     * Build the edit form for the relay node.
     * Filter the cache for system and battery relays.
     */
  getRelayServices () {
    // Build a relay object representing the relay node settings in node-red UI
    const buildRelayService = (service, paths) => {
      const pathObjects = paths.map(p => {
        const svc = service.split('.')[2].split('/')[0] // com.victronenergy.system => system

        // iterate over utils.SERVICES.relay[svc], and expand
        try {
          for (const wildcardedRelay of (utils.SERVICES.relay?.[svc] || [])) {
            const expanded = utils.expandWildcardPaths(wildcardedRelay, this.cache[service], svc)
            const relayObject = _.find(expanded, { path: p })
            if (relayObject) {
              // special case for system relay
              if (service.startsWith('com.victronenergy.system') && p.startsWith('/Relay/0')) {
                const systemRelayFunction = this.cache['com.victronenergy.settings']['/Settings/Relay/Function']
                if (systemRelayFunction !== 2) { // manual
                  relayObject.disabled = true
                  relayObject.warning = utils.RELAY_MODE_WARNING(utils.RELAY_FUNCTIONS[systemRelayFunction])
                } else {
                  relayObject.disabled = false
                  delete (relayObject.warning)
                }
              }
              return relayObject
            }
          }
          // if nothing found, return null
          return null
        } catch (error) {
          console.error(`Error expanding relay paths for service ${svc} with path ${p}:`, error)
          return null
        }
      })

      const name = service.startsWith('com.victronenergy.system')
        ? 'Venus device'
        : this.cache[service]['/CustomName'] ||
                this.cache[service]['/ProductName'] ||
                service.split('.').pop()

      const deviceInstance = this.cache[service]['/DeviceInstance'] || service.split('/')[1] || '-'

      return utils.TEMPLATE(service, name, deviceInstance, pathObjects)
    }

    // Filter all paths that begin with '/Relay'.
    // Construct and return an array of relay nodes representing their settings.
    return Object.entries(this.cache)
      .reduce((acc, [service, pathObj]) => {
        const relayPaths = Object.keys(pathObj).filter(path => path.startsWith('/Relay'))
        if (relayPaths.length) {
          const relaySvc = buildRelayService(service, relayPaths)
          // add the relay service if svc.paths has actually non-nullible values
          // (e.g. paths: [null, null] is not acceptable)
          if (relaySvc.paths.filter(p => p).length > 0) acc.push(relaySvc)
        }
        return acc
      }, [])
  }

  getCachedServices () {
    const cachedService = _.pickBy(this.cache, (val, key) => key.startsWith('com.victronenergy'))
    const services = []
    Object.keys(cachedService).forEach((dbusInterface) => {
      const cachedPaths = cachedService[dbusInterface]
      let name = cachedPaths['/CustomName'] ||
                        cachedPaths['/ProductName']
      if (!name) {
        name = dbusInterface.split('/')[0]
      }
      if (dbusInterface.split('/')[1]) {
        name += ' (' + dbusInterface.split('/')[1] + ')'
      }
      let deviceInstance = cachedPaths['/DeviceInstance']
      if (cachedPaths['/DeviceInstance'] === 0) { deviceInstance = 0 }

      const paths = []
      for (const path in cachedPaths) {
        if (cachedPaths[path] || cachedPaths[path] === 0 || cachedPaths[path] === null) {
          paths.push({ path, name: path, type: typeof (cachedPaths[path]), value: cachedPaths[path] })
        }
      }
      paths.sort((a, b) => a.name > b.name ? 1 : -1)

      services.push(
        {
          service: dbusInterface,
          name,
          deviceInstance,
          paths
        })
    })

    services.sort((a, b) => a.name > b.name ? 1 : -1)
    return services
  }

  /**
     * List all currently available services. This list is used to populate the nodes' edit dialog.
     * E.g. if a battery monitor is available, all the given battery monitor services are listed
     * in the input-battery node.
     *
     * @param {string} service an optional parameter to filter available services based on the given device
     */
  listAvailableServices (device = null) {
    const services = {
      // meta
      version: _.get(packagejson, 'version'),

      // input node services
      'input-accharger': this.getNodeServices('input-accharger'),
      'input-acload': this.getNodeServices('input-acload'),
      'input-acsystem': this.getNodeServices('input-acsystem'),
      'input-alternator': this.getNodeServices('input-alternator'),
      'input-battery': this.getNodeServices('input-battery'),
      'input-dcdc': this.getNodeServices('input-dcdc'),
      'input-dess': this.getNodeServices('input-dess'),
      'input-dcload': this.getNodeServices('input-dcload'),
      'input-dcsource': this.getNodeServices('input-dcsource'),
      'input-dcsystem': this.getNodeServices('input-dcsystem'),
      'input-digitalinput': this.getNodeServices('input-digitalinput'),
      'input-ess': this.getNodeServices('input-ess'),
      'input-evcharger': this.getNodeServices('input-evcharger'),
      'input-fuelcell': this.getNodeServices('input-fuelcell'),
      'input-generator': this.getNodeServices('input-generator'),
      'input-gps': this.getNodeServices('input-gps'),
      'input-gridmeter': this.getNodeServices('input-gridmeter'),
      'input-inverter': this.getNodeServices('input-inverter'),
      'input-meteo': this.getNodeServices('input-meteo'),
      'input-motordrive': this.getNodeServices('input-motordrive'),
      'input-multi': this.getNodeServices('input-multi'),
      'input-pulsemeter': this.getNodeServices('input-pulsemeter'),
      'input-pump': this.getNodeServices('input-pump'),
      'input-pvinverter': this.getNodeServices('input-pvinverter'),
      'input-relay': this.getNodeServices('input-relay'),
      'input-settings': this.getNodeServices('input-settings'),
      'input-solarcharger': this.getNodeServices('input-solarcharger'),
      'input-switch': this.getNodeServices('input-switch'),
      'input-system': this.getNodeServices('input-system'),
      'input-tank': this.getNodeServices('input-tank'),
      'input-temperature': this.getNodeServices('input-temperature'),
      'input-vebus': this.getNodeServices('input-vebus'),

      // output services
      'output-accharger': this.getNodeServices('output-accharger'),
      'output-acsystem': this.getNodeServices('output-acsystem'),
      'output-battery': this.getNodeServices('output-battery'),
      'output-charger': this.getNodeServices('output-charger'),
      'output-dcdc': this.getNodeServices('output-dcdc'),
      'output-dess': this.getNodeServices('output-dess'),
      'output-ess': this.getNodeServices('output-ess'),
      'output-evcharger': this.getNodeServices('output-evcharger'),
      'output-generator': this.getNodeServices('output-generator'),
      'output-inverter': this.getNodeServices('output-inverter'),
      'output-multi': this.getNodeServices('output-multi'),
      'output-pump': this.getNodeServices('output-pump'),
      'output-pvinverter': this.getNodeServices('output-pvinverter'),
      'output-relay': this.getRelayServices(),
      'output-settings': this.getNodeServices('output-settings'),
      'output-solarcharger': this.getNodeServices('output-solarcharger'),
      'output-switch': this.getNodeServices('output-switch'),
      'output-vebus': this.getNodeServices('output-vebus'),

      // custom service
      'input-custom': this.getCachedServices(),
      'output-custom': this.getCachedServices()
    }

    return device !== null
      ? services[device]
      : services
  }
}

module.exports = SystemConfiguration
