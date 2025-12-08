const { formatNotification, validateNotificationInput } = require('./victron-inject-functions')

module.exports = function (RED) {
  const debug = require('debug')('node-red-contrib-victron:victron-inject')

  class VictronInjectNode {
    constructor (nodeDefinition) {
      RED.nodes.createNode(this, nodeDefinition)

      this.node = this
      this.notificationType = nodeDefinition.notificationType
      this.notificationTitle = nodeDefinition.notificationTitle

      this.configNode = RED.nodes.getNode('victron-client-id')
      this.client = this.configNode.client

      this.node.status({
        fill: 'grey',
        shape: 'dot',
        text: 'Ready'
      })

      this.on('input', function (msg) {
        const validation = validateNotificationInput(
          msg.payload,
          msg.type !== undefined ? msg.type : this.notificationType,
          msg.title !== undefined ? msg.title : this.notificationTitle
        )

        if (!validation.valid) {
          const error = new Error(validation.error)
          this.node.status({
            fill: 'red',
            shape: 'dot',
            text: validation.error
          })
          debug(`Validation failed: ${validation.error}`)
          this.node.error(error, msg)
          return
        }

        const { type, title, message } = validation

        const notificationString = formatNotification(type, title, message)

        debug(`Injecting notification: ${notificationString}`)

        const typeColors = {
          0: 'yellow', // Warning
          1: 'red', // Alarm
          2: 'blue' // Information
        }

        const statusColor = typeColors[type] || 'grey'
        const statusText = `${title}: ${message}`

        this.client.publish(
          'com.victronenergy.platform',
          '/Notifications/Inject',
          notificationString,
          (err) => {
            if (err) {
              this.node.status({
                fill: 'red',
                shape: 'ring',
                text: err.message || 'Injection failed'
              })
              debug(`Injection failed: ${err.message}`)
              this.node.error(err, msg)
            } else {
              this.node.status({
                fill: statusColor,
                shape: 'dot',
                text: statusText
              })

              msg.notification = {
                type,
                title,
                message
              }

              this.node.send(msg)
            }
          }
        )
      })

      this.on('close', function (done) {
        done()
      })
    }
  }

  RED.nodes.registerType('victron-inject', VictronInjectNode)
}
