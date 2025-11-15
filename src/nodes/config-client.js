module.exports = function (RED) {
  'use strict'

  const utils = require('../services/utils.js')
  const _ = require('lodash')
  const debug = require('debug')('node-red-contrib-victron:config-client')

  const VictronClient = require('../services/victron-client.js')

  /**
     * VictronClient should be initialized as a global singleton.
     * This way, deploying the flows doesn't reset the connection
     * and cache.
     */
  let globalClient = null

  /**
     * An endpoint for nodes to request services from - returns either a single service, or
     * all available services depending whether the requester gives the service parameter
     */

  RED.httpNode.get('/victron/services/:service?', RED.auth.needsPermission('victron-client.read'), (req, res) => {
    debug('Services endpoint hit, globalClient exists:', !!globalClient)
    debug('globalClient type:', typeof globalClient)
    if (globalClient) {
      debug('globalClient.system exists:', !!globalClient.system)
    }

    if (!globalClient) {
      debug('Returning 503 - Client not initialized')
      return res.status(503).send('Client not initialized')
    }

    try {
      const services = globalClient.system.listAvailableServices(req.params.service)
      debug('Found services:', services.length)
      const serialized = JSON.stringify(services)
      res.setHeader('Content-Type', 'application/json')
      return res.send(serialized)
    } catch (error) {
      debug('Error getting services:', error)
      return res.status(500).send('Error getting services')
    }
  })

  RED.httpNode.get('/victron/cache', RED.auth.needsPermission('victron-client.read'), (_req, res) => {
    if (!globalClient) return res.status(503).send('Client not initialized')
    const serialized = utils.mapCacheToJsonResponse(globalClient.system.cache)
    res.setHeader('Content-Type', 'application/json')
    return res.send(serialized)
  })

  /**
   * An endpoint to get available service types from services.json
   */
  RED.httpNode.get('/victron/service-types', RED.auth.needsPermission('victron-client.read'), (_req, res) => {
    // Filter out service types that are singleton/global (no device instances)
    const excludedTypes = ['system', 'settings', 'dess']

    const serviceTypes = Object.keys(utils.SERVICES)
      .filter(key => !excludedTypes.includes(key))
      .sort()
      .map(key => ({
        value: key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
      }))
    res.setHeader('Content-Type', 'application/json')
    return res.send(JSON.stringify(serviceTypes))
  })

  /**
   * An endpoint to get path definitions for a service type from services.json
   * This returns all possible paths regardless of whether any instances currently exist
   */
  RED.httpNode.get('/victron/service-type-paths/:serviceType', RED.auth.needsPermission('victron-client.read'), (req, res) => {
    const serviceType = req.params.serviceType

    if (!serviceType) {
      return res.status(400).send('Service type is required')
    }

    const serviceDef = utils.SERVICES[serviceType]
    if (!serviceDef) {
      return res.status(404).send('Service type not found')
    }

    const serviceKeys = Object.keys(serviceDef).filter(k => k !== 'help')
    if (serviceKeys.length === 0) {
      return res.status(404).send('No paths found for service type')
    }

    // Some services like temperature have multiple keys
    const allPaths = []
    serviceKeys.forEach(key => {
      if (Array.isArray(serviceDef[key])) {
        allPaths.push(...serviceDef[key])
      }
    })

    const inputPaths = allPaths.filter(pathDef =>
      pathDef.mode === 'both' ||
      pathDef.mode === 'input' ||
      !pathDef.mode
    )

    const paths = inputPaths.map(pathDef => ({
      path: pathDef.path,
      name: pathDef.name,
      type: pathDef.type,
      enum: pathDef.enum
    }))

    res.setHeader('Content-Type', 'application/json')
    return res.send(JSON.stringify(paths))
  })

  /**
     * Victron Energy Configuration Node.
     *
     * This global configuration node is used by
     * all the other Victron Energy nodes to access the dbus.
     *
     * It keeps track of incoming status messages and updates
     * listening nodes' status in the UI accordingly.
     */
  function ConfigVictronClient (config) {
    debug('ConfigVictronClient constructor called')
    debug('NODE_RED_DBUS_ADDRESS:', process.env.NODE_RED_DBUS_ADDRESS)

    RED.nodes.createNode(this, config)

    if (!globalClient) {
      console.log('Creating new VictronClient')
      const enablePolling = config.enablePolling || false
      globalClient = new VictronClient(
        process.env.NODE_RED_DBUS_ADDRESS,
        { enablePolling }
      )
      globalClient.connect()
    }

    this.client = globalClient
    this.showValues = config.showValues
    this.enablePolling = config.enablePolling || false
    this.contextStore = config.contextStore
    let statusListeners = []

    /**
         * This node registers a VictronClient status update listener
         * that updates each node's statuses when a path gets added
         * or a service removed.
         *
         * Current architecture supports for service and path additions,
         * but only service-level disconnects (so, e.g. a disappearing
         * system relay doesn't get registered).
         */
    const serviceDiscoveryCallbacks = []

    this.client.onStatusUpdate = (msg, status) => {
      statusListeners.forEach(obj => {
        if (obj.service && obj.service === msg.service) {
          if (status === utils.STATUS.SERVICE_REMOVE) { obj.node.status(utils.DISCONNECTED) } else if (status === utils.STATUS.PATH_ADD && obj.path === msg.path) {
            obj.node.status(utils.CONNECTED)
          } else if (status === utils.STATUS.SERVICE_MIGRATE) { obj.node.status(utils.MIGRATE) }
        }
      })

      serviceDiscoveryCallbacks.forEach(obj => {
        obj.callback(msg.service, status)
      })
    }

    // isConnected function is called to check the node
    // connection state and adjust the node status accordingly
    this.addStatusListener = (listener, service, path) => {
      const id = utils.UUID()

      listener.status(utils.DISCONNECTED)
      // Upon initialization, the initial node status will be fetched from the cache
      if (service) {
        if (_.get(this.client, ['system', 'cache', service, path]) !== undefined) {
          listener.status(utils.CONNECTED)
        }
      }

      statusListeners.push({
        node: listener,
        service,
        path,
        id
      })

      return id
    }

    this.removeStatusListener = id => { statusListeners = statusListeners.filter(o => o.id === id) }

    this.addServiceDiscoveryCallback = (callback) => {
      const id = utils.UUID()
      serviceDiscoveryCallbacks.push({ id, callback })
      return id
    }

    this.removeServiceDiscoveryCallback = id => {
      const index = serviceDiscoveryCallbacks.findIndex(o => o.id === id)
      if (index !== -1) {
        serviceDiscoveryCallbacks.splice(index, 1)
      }
    }
  }

  RED.nodes.registerType('victron-client', ConfigVictronClient)
}
