module.exports = function (RED) {
  const debug = require('debug')('node-red-contrib-victron:dynamic')
  const utils = require('../services/utils.js')

  function VictronDynamic (nodeDefinition) {
    RED.nodes.createNode(this, nodeDefinition)

    this.node = this
    this.serviceType = nodeDefinition.serviceType
    this.paths = nodeDefinition.paths || []
    this.onlyChanges = nodeDefinition.onlyChanges
    this.roundValues = nodeDefinition.roundValues
    this.rateLimit = nodeDefinition.rateLimit || 0
    this.subscriptions = []
    this.previousValues = {} // Track previous values per service+path

    this.configNode = RED.nodes.getNode('victron-client-id')
    this.client = this.configNode.client

    const handlerIds = []
    let discoveryCallbackId = null

    this.paths.forEach(path => {
      const handlerId = this.configNode.addStatusListener(this, `com.victronenergy.${this.serviceType}`, path)
      handlerIds.push(handlerId)
    })

    const matchesServiceType = (serviceName) => {
      const servicePrefix = `com.victronenergy.${this.serviceType}.`
      return serviceName.startsWith(servicePrefix)
    }

    const subscribeToService = (serviceName) => {
      this.paths.forEach(configuredPath => {
        const serviceCache = this.client.system.cache[serviceName] || {}
        const dbusServiceType = serviceName.split('.')[2].split('/')[0] // Extract service type from full service name

        let pathsToSubscribe = []
        if (configuredPath.includes('{')) {
          const pathObj = { path: configuredPath }
          const expandedPaths = utils.expandWildcardPaths(pathObj, serviceCache, dbusServiceType)
          pathsToSubscribe = expandedPaths.map(p => p.path)
        } else {
          pathsToSubscribe = [configuredPath]
        }

        pathsToSubscribe.forEach(path => {
          const trackingKey = `${serviceName}${path}`

          const processMessage = (msg) => {
            if (this.node.onlyChanges && msg.changed === false && this.previousValues[trackingKey] !== undefined) {
              return
            }

            let value = msg.value

            if ((Number(this.node.roundValues) >= 0) && (typeof value === 'number')) {
              value = +value.toFixed(this.node.roundValues)
            }

            if (this.node.onlyChanges && this.previousValues[trackingKey] === value) {
              return
            }

            this.previousValues[trackingKey] = value

            const outMsg = {
              payload: value,
              service: serviceName,
              path
            }

            if (msg.textValue !== undefined) {
              outMsg.textValue = msg.textValue
            }

            this.node.send(outMsg)
          }

          const throttleMs = this.rateLimit > 0 ? Math.floor(1000 / this.rateLimit) : 0
          const throttledProcessMessage = throttleMs > 0 ? utils.throttle(processMessage, throttleMs) : processMessage

          const isPollingEnabled = this.configNode.enablePolling || false
          const callbackPeriodically = !this.node.onlyChanges && !isPollingEnabled

          const subscription = this.client.subscribe(serviceName, path, (msg) => {
            throttledProcessMessage(msg)
          }, { callbackPeriodically })

          this.subscriptions.push({ subscription, serviceName, path })
        })
      })
    }

    const unsubscribeFromService = (serviceName) => {
      const serviceSubscriptions = this.subscriptions.filter(sub => sub.serviceName === serviceName)
      serviceSubscriptions.forEach(sub => {
        this.client.unsubscribe(sub.subscription)
      })
      this.subscriptions = this.subscriptions.filter(sub => sub.serviceName !== serviceName)
      debug(`Unsubscribed from service: ${serviceName}`)
    }

    const performInitialDiscovery = () => {
      const matchingServices = this.discoverServices()
      debug(`Discovered ${matchingServices.length} service(s) for type '${this.serviceType}'`)
      matchingServices.forEach(subscribeToService)
      this.updateStatus(matchingServices.length)
      return matchingServices.length
    }

    const count = performInitialDiscovery()

    // If no services found initially, retry after cache has had time to populate
    if (count === 0 && this.client && this.client.client) {
      debug('No services found initially, will retry after cache populates')
      setTimeout(() => {
        const retryCount = performInitialDiscovery()
        debug(`Retry discovery found ${retryCount} service(s)`)
      }, 1500)
    }

    discoveryCallbackId = this.configNode.addServiceDiscoveryCallback((serviceName, status) => {
      if (matchesServiceType(serviceName)) {
        if (status === utils.STATUS.SERVICE_MIGRATE) {
          debug(`New service detected: ${serviceName}`)
          subscribeToService(serviceName)
          const currentCount = this.discoverServices().length
          this.updateStatus(currentCount)
        } else if (status === utils.STATUS.SERVICE_REMOVE) {
          debug(`Service removed: ${serviceName}`)
          unsubscribeFromService(serviceName)
          const currentCount = this.discoverServices().length
          this.updateStatus(currentCount)
        }
      }
    })

    this.on('close', (done) => {
      this.subscriptions.forEach(sub => {
        this.client.unsubscribe(sub.subscription)
      })

      handlerIds.forEach(handlerId => {
        this.configNode.removeStatusListener(handlerId)
      })

      if (discoveryCallbackId) {
        this.configNode.removeServiceDiscoveryCallback(discoveryCallbackId)
      }

      this.subscriptions = []
      this.previousValues = {}
      done()
    })
  }

  /**
   * Discover all D-Bus services matching the configured service type
   * @returns {string[]} Array of full service names (e.g., ["com.victronenergy.battery.ttyUSB0"])
   */
  VictronDynamic.prototype.discoverServices = function () {
    if (!this.client || !this.client.system || !this.client.system.cache) {
      return []
    }

    const servicePrefix = `com.victronenergy.${this.serviceType}`
    const cache = this.client.system.cache

    return Object.keys(cache).filter(serviceName => serviceName.startsWith(servicePrefix))
  }

  /**
   * Update node status to show number of monitored services
   * @param {number} count Number of services being monitored
   */
  VictronDynamic.prototype.updateStatus = function (count) {
    if (count === 0) {
      this.status({ fill: 'yellow', shape: 'ring', text: `No ${this.serviceType} services found` })
    } else {
      const pathText = this.paths.length === 1 ? '1 path' : `${this.paths.length} paths`
      const serviceText = count === 1 ? `1 ${this.serviceType} service` : `${count} ${this.serviceType} services`
      this.status({ fill: 'green', shape: 'dot', text: `Found ${serviceText}, monitoring ${pathText}` })
    }
  }

  RED.nodes.registerType('victron-dynamic', VictronDynamic)
}