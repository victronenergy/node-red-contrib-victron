module.exports = function (RED) {
  'use strict'

  const utils = require('../services/utils.js')
  const _ = require('lodash')

  const VictronClient = require('../services/victron-client.js')

  /**
     * VictronClient should be initialized as a global singleton.
     * This way, deploying the flows doesn't reset the connection
     * and cache.
     */
  const globalClient = new VictronClient(process.env.NODE_RED_DBUS_ADDRESS)
  globalClient.connect()

  /**
     * An endpoint for nodes to request services from - returns either a single service, or
     * all available services depending whether the requester gives the service parameter
     */

  RED.httpNode.get('/victron/services/:service?', RED.auth.needsPermission('victron-client.read'), (req, res) => {
    const serialized = JSON.stringify(globalClient.system.listAvailableServices(req.params.service))
    res.setHeader('Content-Type', 'application/json')
    return res.send(serialized)
  })

  RED.httpNode.get('/victron/cache', RED.auth.needsPermission('victron-client.read'), (req, res) => {
    const serialized = JSON.stringify(globalClient.system.cache)
    res.setHeader('Content-Type', 'application/json')
    return res.send(serialized)
  })

  // Track last assigned instance numbers
  const lastAssignedInstances = new Map()

  function findNextAvailableInstance (jsonStr, deviceType) {
    const data = JSON.parse(jsonStr)
    const victronSettings = data['com.victronenergy.settings']

    if (!victronSettings) {
      return null
    }

    // Get all used instance numbers for the specified device type
    const usedInstances = new Set()

    function collectInstances (obj) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          collectInstances(value)
        } else if (
          key.endsWith('ClassAndVrmInstance') &&
            typeof value === 'string' &&
            value.startsWith(deviceType + ':')
        ) {
          const instance = parseInt(value.split(':')[1])
          if (!isNaN(instance)) {
            usedInstances.add(instance)
          }
        }
      }
    }

    collectInstances(victronSettings)

    // Get the last assigned number for this device type, or start at 99
    let nextInstance = (lastAssignedInstances.get(deviceType) || 99) + 1

    // Keep incrementing until we find an unused number
    while (usedInstances.has(nextInstance)) {
      nextInstance++
    }

    // Store this assignment for future requests
    lastAssignedInstances.set(deviceType, nextInstance)

    return nextInstance
  }

  RED.httpNode.get('/victron/deviceinstance/:type', RED.auth.needsPermission('victron-client.read'), (req, res) => {
    try {
      const serialized = JSON.stringify(globalClient.system.cache)
      const nextInstance = findNextAvailableInstance(serialized, req.params.type)

      if (nextInstance === null) {
        return res.status(404).json({ error: 'No settings found' })
      }

      res.setHeader('Content-Type', 'application/json')
      return res.json({ instance: nextInstance })
    } catch (error) {
      console.error('Error finding next instance:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
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
    RED.nodes.createNode(this, config)

    this.client = globalClient
    this.showValues = config.showValues
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
    this.client.onStatusUpdate = (msg, status) => {
      statusListeners.forEach(obj => {
        if (obj.service && obj.service === msg.service) {
          if (status === utils.STATUS.SERVICE_REMOVE) { obj.node.status(utils.DISCONNECTED) } else if (status === utils.STATUS.PATH_ADD && obj.path === msg.path) {
            obj.node.status(utils.CONNECTED)
          } else if (status === utils.STATUS.SERVICE_MIGRATE) { obj.node.status(utils.MIGRATE) }
        }
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
  }

  RED.nodes.registerType('victron-client', ConfigVictronClient)
}
