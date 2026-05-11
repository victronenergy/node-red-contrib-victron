'use strict'

const { formatEvent, validateEventInput } = require('./victron-event-functions')

module.exports = function (RED) {
  const debug = require('debug')('node-red-contrib-victron:victron-event')

  class VictronInjectEventNode {
    constructor (nodeDefinition) {
      RED.nodes.createNode(this, nodeDefinition)

      this.node = this
      this.severity = nodeDefinition.severity
      this.app = nodeDefinition.app

      this.configNode = RED.nodes.getNode('victron-client-id')
      this.client = this.configNode.client

      this.node.status({ fill: 'grey', shape: 'dot', text: 'Ready' })

      this.on('input', function (msg) {
        const validation = validateEventInput(
          msg.payload,
          msg.severity !== undefined ? msg.severity : this.severity,
          msg.app !== undefined ? msg.app : this.app
        )

        if (!validation.valid) {
          const error = new Error(validation.error)
          this.node.status({ fill: 'red', shape: 'dot', text: validation.error })
          debug(`Validation failed: ${validation.error}`)
          this.node.error(error, msg)
          return
        }

        const { severity, app, message } = validation
        const eventString = formatEvent(1, severity, app, message)

        debug(`Injecting event: ${eventString}`)

        const severityColors = { 0: 'yellow', 1: 'red', 2: 'blue' }

        this.client.publish(
          'com.victronenergy.logger',
          '/EventLogging/Inject',
          eventString,
          (err) => {
            if (err) {
              this.node.status({ fill: 'red', shape: 'ring', text: err.message || 'Injection failed' })
              debug(`Injection failed: ${err.message}`)
              this.node.error(err, msg)
            } else {
              this.node.status({
                fill: severityColors[severity] || 'grey',
                shape: 'dot',
                text: `${app}: ${message}`
              })
              msg.event = { severity, app, message }
              this.node.send(msg)
            }
          }
        )
      })

      this.on('close', function (done) { done() })
    }
  }

  RED.nodes.registerType('victron-event', VictronInjectEventNode)
}
