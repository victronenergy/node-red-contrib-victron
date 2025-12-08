module.exports = function (RED) {
  const debug = require('debug')('node-red-contrib-victron:victron-nodes')
  const utils = require('../services/utils.js')

  const migrateSubscriptions = (x) => {
    // Check if client is fully initialized
    if (!x.client || !x.client.client || !x.client.client.services) {
      debug('Client not fully initialized for migration. Will retry in 1 second')
      // Retry after a delay
      setTimeout(migrateSubscriptions, 1000, x)
      return
    } else {
      const services = x.client.client.services
      for (const key in services) {
        if (services[key].name === x.service) {
          x.deviceInstance = services[key].deviceInstance
          break
        }
      }
    }
    if (typeof x.deviceInstance !== 'undefined' && x.deviceInstance.toString().match(/^\d+$/)) {
      const dbusInterface = x.service.split('.').splice(0, 3).join('.') + ('/' + x.deviceInstance).replace(/\/$/, '')
      // var dbusInterface = x.service
      const newsub = dbusInterface + ':' + x.path
      const oldsub = x.service + ':' + x.path
      if (x.client.subscriptions[oldsub]) {
        debug(`Migrating subscription from ${oldsub} to ${newsub} (please update your flow)`)
        x.client.subscriptions[oldsub][0].dbusInterface = dbusInterface
        if (newsub in x.client.subscriptions) {
          x.client.subscriptions[newsub].push(x.client.subscriptions[oldsub][0])
        } else {
          x.client.subscriptions[newsub] = x.client.subscriptions[oldsub]
        }
        delete x.client.subscriptions[oldsub]
        delete x.client.system.cache[x.service.split('.').splice(0, 3).join('.')]
        x.client.onStatusUpdate({ service: x.service }, utils.STATUS.SERVICE_MIGRATE)
      }
    } else {
      if (typeof x.deviceInstance !== 'undefined') { debug(`Failed to migrate service ${x.service}`) }
    }
  }

  class BaseInputNode {
    constructor (nodeDefinition) {
      RED.nodes.createNode(this, nodeDefinition)

      this.node = this

      this.service = nodeDefinition.service
      this.path = nodeDefinition.path
      this.pathObj = nodeDefinition.pathObj
      this.defaulttopic = (nodeDefinition.serviceObj && nodeDefinition.pathObj)
        ? nodeDefinition.serviceObj.name + ' - ' + nodeDefinition.pathObj.name
        : 'unknown'
      this.onlyChanges = nodeDefinition.onlyChanges
      this.roundValues = nodeDefinition.roundValues
      this.rateLimit = nodeDefinition.rateLimit || 0
      this.sentInitialValue = false

      // Conditional mode configuration
      this.conditionalMode = nodeDefinition.conditionalMode || false
      this.condition1Operator = nodeDefinition.condition1Operator
      this.condition1Threshold = nodeDefinition.condition1Threshold
      this.condition2Enabled = nodeDefinition.condition2Enabled || false
      this.condition2Service = nodeDefinition.condition2Service
      this.condition2Path = nodeDefinition.condition2Path
      this.condition2Operator = nodeDefinition.condition2Operator
      this.condition2Threshold = nodeDefinition.condition2Threshold
      this.logicOperator = nodeDefinition.logicOperator || 'AND'
      this.outputTrue = nodeDefinition.outputTrue
      this.outputFalse = nodeDefinition.outputFalse
      // Always enforce output-on-change for conditional mode (only send when result changes)
      this.outputOnChange = this.conditionalMode ? true : (nodeDefinition.outputOnChange !== undefined ? nodeDefinition.outputOnChange : false)
      this.debounce = nodeDefinition.debounce || 0

      // Conditional mode state
      this.condition1CurrentValue = null
      this.condition2CurrentValue = null
      this.lastConditionalResult = null
      this.debounceTimer = null

      this.configNode = RED.nodes.getNode('victron-client-id')
      this.client = this.configNode.client

      this.subscription = null
      this.subscription2 = null

      const handlerId = this.configNode.addStatusListener(this, this.service, this.path)
      let handlerId2 = null

      if (this.service && this.path) {
        // The following is for migration purposes
        if (!this.service.match(/\/\d+$/)) {
          this.deviceInstance = this.service.replace(/^.*\.(\d+)$/, '$1')
          this.service = this.service.replace(/\.\d+$/, '')
          // Only call getValue if the client is initialized and connected
          if (this.client && this.client.client && this.client.client.connected) {
            this.client.client.getValue(this.service, '/DeviceInstance')
          } else {
            // Log a debug message if we can't get the value yet
            debug('Client not connected yet, delaying getValue call for ' + this.service)
            // We'll rely on the migrateSubscriptions function to retry
          } setTimeout(migrateSubscriptions, 1000, this)
        }

        // Helper function to evaluate a condition
        const evaluateCondition = (currentValue, operator, threshold) => {
          if (currentValue === null || currentValue === undefined || isNaN(currentValue)) {
            return null
          }
          const current = Number(currentValue)
          const thresholdNum = Number(threshold)
          if (isNaN(thresholdNum)) return null

          const getEpsilon = (a, b) => {
            const absMax = Math.max(Math.abs(a), Math.abs(b))
            return absMax === 0 ? 1e-10 : absMax * 1e-10
          }

          switch (operator) {
            case '>': return current > thresholdNum
            case '>=': return current >= thresholdNum
            case '<': return current < thresholdNum
            case '<=': return current <= thresholdNum
            case '==': return Math.abs(current - thresholdNum) < getEpsilon(current, thresholdNum)
            case '!=': return Math.abs(current - thresholdNum) >= getEpsilon(current, thresholdNum)
            default: return null
          }
        }

        // Helper function to parse output value (JSON or literal)
        const parseOutputValue = (configValue, defaultValue) => {
          if (!configValue || configValue.trim() === '') {
            return defaultValue
          }
          try {
            return JSON.parse(configValue)
          } catch (e) {
            return configValue
          }
        }

        // Message processing function
        const processMessage = (msg) => {
          let topic = this.defaulttopic
          if (this.node.name) {
            topic = this.node.name
          }

          // Store value for conditional evaluation
          if (this.conditionalMode) {
            this.condition1CurrentValue = msg.value
          }

          if (this.node.onlyChanges && msg.changed === false && this.sentInitialValue) {
            return
          }
          if ((Number(this.node.roundValues) >= 0) && (typeof (msg.value) === 'number')) {
            msg.value = +msg.value.toFixed(this.node.roundValues)
          }
          if (this.node.onlyChanges && this.node.previousvalue === msg.value) {
            return
          }
          if (this.configNode && (this.configNode.contextStore || typeof this.configNode.contextStore === 'undefined')) {
            const transform = (input) => {
              input = input.replace(/^com\./, '')
              return input.replace(/\/(\d+\b)?|\/|(\b\d+\b)/g, (match, p1, p2) => {
                if (p1) return `._${p1}`
                if (p2) return `_${p2}`
                return '.'
              })
            }
            const globalContext = this.node.context().global
            globalContext.set(transform(`${this.service}${this.path}`), msg.value)
          }
          this.node.previousvalue = msg.value

          // Prepare raw value message
          const outmsg = {
            payload: msg.value,
            topic
          }
          let text = msg.value
          if (this.node.pathObj.type === 'enum') {
            outmsg.textvalue = this.node.pathObj.enum[msg.value] || ''
            text = `${msg.value} (${this.node.pathObj.enum[msg.value]})`
          }

          // If conditional mode is enabled, send raw value to output 1 and evaluate for output 2
          if (this.conditionalMode) {
            this.node.send([outmsg, null]) // Send to output 1 only
            this.evaluateAndSendConditional(topic, msg.value)
          } else {
            // Normal mode: send raw value to single output
            this.node.send(outmsg)
            if (this.configNode.showValues !== false) {
              const textValue = text && text.toString ? text : text === null || text === undefined ? 'null' : `${text}`
              this.node.status({ fill: 'green', shape: 'dot', text: textValue })
            }
          }

          if (!this.sentInitialValue) {
            this.sentInitialValue = true
          }
        }

        // Evaluate conditions and send conditional output
        this.evaluateAndSendConditional = (topic, primaryValue) => {
          const result1 = evaluateCondition(
            this.condition1CurrentValue,
            this.condition1Operator,
            this.condition1Threshold
          )

          if (result1 === null) {
            if (this.configNode.showValues !== false) {
              const valueText = this.condition1CurrentValue !== null && this.condition1CurrentValue !== undefined
                ? this.condition1CurrentValue.toString()
                : 'null'
              this.node.status({ fill: 'yellow', shape: 'ring', text: `${valueText} | waiting` })
            }
            return
          }

          let result2 = null
          if (this.condition2Enabled) {
            result2 = evaluateCondition(
              this.condition2CurrentValue,
              this.condition2Operator,
              this.condition2Threshold
            )

            if (result2 === null) {
              if (this.configNode.showValues !== false) {
                const valueText = this.condition1CurrentValue !== null && this.condition1CurrentValue !== undefined
                  ? this.condition1CurrentValue.toString()
                  : 'null'
                this.node.status({ fill: 'yellow', shape: 'ring', text: `${valueText} | waiting C2` })
              }
              return
            }
          }

          // Calculate final result
          let finalResult = result1
          if (this.condition2Enabled && result2 !== null) {
            if (this.logicOperator === 'AND') {
              finalResult = result1 && result2
            } else if (this.logicOperator === 'OR') {
              finalResult = result1 || result2
            }
          }

          // Check if result changed
          const resultChanged = this.lastConditionalResult !== finalResult

          // Handle debounce
          if (this.debounce > 0 && resultChanged) {
            if (this.debounceTimer) {
              clearTimeout(this.debounceTimer)
            }
            this.debounceTimer = setTimeout(() => {
              this.sendConditionalOutput(finalResult, resultChanged, topic, result1, result2, primaryValue)
            }, this.debounce)
          } else {
            this.sendConditionalOutput(finalResult, resultChanged, topic, result1, result2, primaryValue)
          }
        }

        // Send conditional output
        this.sendConditionalOutput = (result, resultChanged, topic, result1, result2, primaryValue) => {
          // Check if we should send based on outputOnChange setting
          if (this.outputOnChange && !resultChanged && this.lastConditionalResult !== null) {
            debug('Output on change only: result unchanged, not sending')
            if (this.configNode.showValues !== false) {
              const valueText = this.condition1CurrentValue !== null && this.condition1CurrentValue !== undefined
                ? this.condition1CurrentValue.toString()
                : 'null'
              const statusText = `${valueText} | ${result ? 'true' : 'false'}`
              this.node.status({ fill: result ? 'green' : 'red', shape: 'dot', text: statusText })
            }
            return
          }

          this.lastConditionalResult = result

          // Parse output values
          const payload = result
            ? parseOutputValue(this.outputTrue, true)
            : parseOutputValue(this.outputFalse, false)

          // Build diagnostic info
          const info = {
            condition1: {
              value: this.condition1CurrentValue,
              operator: this.condition1Operator,
              threshold: this.condition1Threshold,
              result: result1
            }
          }

          if (this.condition2Enabled) {
            info.condition2 = {
              service: this.condition2Service,
              path: this.condition2Path,
              value: this.condition2CurrentValue,
              operator: this.condition2Operator,
              threshold: this.condition2Threshold,
              result: result2
            }
            info.logicOperator = this.logicOperator
          }

          info.finalResult = result

          const outmsg = {
            payload,
            topic,
            info
          }

          // Send to output 2 (index 1) only
          this.node.send([null, outmsg])

          // Update status - show value and conditional result
          if (this.configNode.showValues !== false) {
            const valueText = this.condition1CurrentValue !== null && this.condition1CurrentValue !== undefined
              ? this.condition1CurrentValue.toString()
              : 'null'
            const statusText = `${valueText} | ${result ? 'true' : 'false'}`
            this.node.status({ fill: result ? 'green' : 'red', shape: 'dot', text: statusText })
          }
        }

        // Apply throttling if rate limit is set
        const throttleMs = this.rateLimit > 0 ? Math.floor(1000 / this.rateLimit) : 0
        const throttledProcessMessage = throttleMs > 0 ? utils.throttle(processMessage, throttleMs) : processMessage

        const isPollingEnabled = this.configNode.enablePolling || false
        const callbackPeriodically = !this.node.onlyChanges && !isPollingEnabled
        this.subscription = this.client.subscribe(this.service, this.path, (msg) => {
          // Always call the (possibly throttled) process function
          // If not throttled, it runs immediately. If throttled, it schedules with latest value
          throttledProcessMessage(msg)
        }, { callbackPeriodically })

        // Subscribe to condition 2 if enabled
        if (this.conditionalMode && this.condition2Enabled && this.condition2Service && this.condition2Path) {
          handlerId2 = this.configNode.addStatusListener(this, this.condition2Service, this.condition2Path)

          this.subscription2 = this.client.subscribe(this.condition2Service, this.condition2Path, (msg) => {
            try {
              if (!msg || msg.value === undefined) {
                debug('Received invalid message for condition 2:', msg)
                return
              }
              this.condition2CurrentValue = msg.value
              debug(`Condition 2 value updated: ${this.condition2CurrentValue}`)
              // Trigger evaluation
              let topic = this.defaulttopic
              if (this.node.name) {
                topic = this.node.name
              }
              this.evaluateAndSendConditional(topic, this.condition1CurrentValue)
            } catch (error) {
              this.node.error(`Error processing condition 2 update: ${error.message}`, msg)
              if (this.configNode.showValues !== false) {
                this.node.status({ fill: 'red', shape: 'ring', text: 'Error: ' + error.message })
              }
            }
          })

          if (this.client && this.client.client && this.client.client.connected) {
            this.client.client.getValue(this.condition2Service, this.condition2Path)
          }
        }
      }

      if (this.client && this.client.client && this.client.client.connected) {
        this.client.client.getValue(this.service, this.path)
      }

      this.on('close', function (done) {
        // Clear debounce timer
        if (this.node.debounceTimer) {
          clearTimeout(this.node.debounceTimer)
          this.node.debounceTimer = null
        }

        // Unsubscribe from primary subscription
        if (this.node.subscription) {
          this.node.client.unsubscribe(this.node.subscription)
          this.node.subscription = null
        }

        // Unsubscribe from condition 2 subscription
        if (this.node.subscription2) {
          this.node.client.unsubscribe(this.node.subscription2)
          this.node.subscription2 = null
        }

        // Remove status listeners
        this.node.configNode.removeStatusListener(handlerId)
        if (handlerId2) {
          this.node.configNode.removeStatusListener(handlerId2)
        }

        this.sentInitialValue = false
        done()
      })
    }
  }

  class BaseOutputNode {
    constructor (nodeDefinition) {
      RED.nodes.createNode(this, nodeDefinition)

      this.node = this
      this.pathObj = nodeDefinition.pathObj
      this.service = nodeDefinition.service
      this.path = nodeDefinition.path

      // Migrate string initial values to proper types
      let initialValue = nodeDefinition.initial
      if (initialValue !== undefined && initialValue !== null && nodeDefinition.pathObj) {
        const pathType = nodeDefinition.pathObj.type
        if ((pathType === 'float' || pathType === 'integer' || pathType === 'enum') && typeof initialValue === 'string') {
          const numValue = pathType === 'integer' || pathType === 'enum' ? parseInt(initialValue) : parseFloat(initialValue)
          if (!isNaN(numValue)) {
            initialValue = numValue
            debug(`Migrated initial value from string "${nodeDefinition.initial}" to number ${numValue}`)
          }
        }
      }
      this.initialValue = initialValue

      this.configNode = RED.nodes.getNode('victron-client-id')
      this.client = this.configNode.client

      const handlerId = this.configNode.addStatusListener(this, this.service, this.path)

      const setValue = (value, path) => {
        if (!path && !this.path) {
          throw new Error(`Output node ${this.id} requires a path to write to, service: ${this.service}`)
        }

        const usedTypes = {
          string: 'string',
          float: 'number',
          enum: 'number',
          integer: 'number',
          object: typeof value,
          number: 'number'
        }

        let writepath = this.path
        let shape = 'dot'

        if (path && path !== this.path) {
          writepath = path
          shape = 'ring'
        }

        if (!/^\/.*/.test(writepath)) {
          writepath = '/' + writepath
        }

        if (!this.pathObj.disabled && this.service && writepath) {
          // If the value is null, just call.
          if (value === null) {
            this.client.publish(this.service, writepath, value, (err) => {
              this.node.status({
                fill: err ? 'red' : 'green',
                shape,
                text: err ? (err.message || 'An unknown error occurred.') : 'Set to null'
              })
            })
            this.node.status({
              fill: 'yellow',
              shape,
              text: 'Setting to null...'
            })
            return
          }

          // Check that the value type matches what's expected
          const valueType = typeof value
          if (valueType !== usedTypes[this.pathObj.type]) {
            this.node.status({
              fill: 'red',
              shape,
              text: `Invalid input type ${valueType}, expecting ${usedTypes[this.pathObj.type]}`
            })
            return
          }

          // Additional validation for enum values
          if (this.pathObj.type === 'enum' && !Object.hasOwn(this.pathObj.enum, value)) {
            this.node.status({
              fill: 'red',
              shape,
              text: 'Invalid enum value'
            })
            return
          }

          const text = this.pathObj.type === 'enum' ? `${value} (${this.pathObj.enum[value]})` : value
          this.client.publish(this.service, writepath, value, (err) => {
            this.node.status({
              fill: err ? 'red' : 'green',
              shape,
              text: err ? (err.message || 'An unknown error occurred') : (this.configNode.showValues === false ? undefined : text)
            })
          })
          this.node.status({
            fill: 'yellow',
            shape,
            text: 'Setting value...'
          })
        }
      }

      // Set initial value only if it's not empty
      if (this.initialValue !== undefined &&
        this.initialValue !== null &&
        this.initialValue !== '') {
        setValue(this.initialValue)
      }

      this.on('input', function (msg) {
        setValue(msg.payload, msg.path)
      })

      this.on('close', function (done) {
        this.node.configNode.removeStatusListener(handlerId)
        done()
      })
    }
  }

  // Input nodes
  RED.nodes.registerType('victron-input-accharger', BaseInputNode)
  RED.nodes.registerType('victron-input-acload', BaseInputNode)
  RED.nodes.registerType('victron-input-acsystem', BaseInputNode)
  RED.nodes.registerType('victron-input-alternator', BaseInputNode)
  RED.nodes.registerType('victron-input-battery', BaseInputNode)
  RED.nodes.registerType('victron-input-custom', BaseInputNode)
  RED.nodes.registerType('victron-input-dcdc', BaseInputNode)
  RED.nodes.registerType('victron-input-dcload', BaseInputNode)
  RED.nodes.registerType('victron-input-dcsource', BaseInputNode)
  RED.nodes.registerType('victron-input-dcsystem', BaseInputNode)
  RED.nodes.registerType('victron-input-dess', BaseInputNode)
  RED.nodes.registerType('victron-input-digitalinput', BaseInputNode)
  RED.nodes.registerType('victron-input-ess', BaseInputNode)
  RED.nodes.registerType('victron-input-evcharger', BaseInputNode)
  RED.nodes.registerType('victron-input-fuelcell', BaseInputNode)
  RED.nodes.registerType('victron-input-generator', BaseInputNode)
  RED.nodes.registerType('victron-input-gps', BaseInputNode)
  RED.nodes.registerType('victron-input-gridmeter', BaseInputNode)
  RED.nodes.registerType('victron-input-inverter', BaseInputNode)
  RED.nodes.registerType('victron-input-meteo', BaseInputNode)
  RED.nodes.registerType('victron-input-motordrive', BaseInputNode)
  RED.nodes.registerType('victron-input-multi', BaseInputNode)
  RED.nodes.registerType('victron-input-pulsemeter', BaseInputNode)
  RED.nodes.registerType('victron-input-pump', BaseInputNode)
  RED.nodes.registerType('victron-input-pvinverter', BaseInputNode)
  RED.nodes.registerType('victron-input-relay', BaseInputNode)
  RED.nodes.registerType('victron-input-settings', BaseInputNode)
  RED.nodes.registerType('victron-input-solarcharger', BaseInputNode)
  RED.nodes.registerType('victron-input-switch', BaseInputNode)
  RED.nodes.registerType('victron-input-system', BaseInputNode)
  RED.nodes.registerType('victron-input-tank', BaseInputNode)
  RED.nodes.registerType('victron-input-temperature', BaseInputNode)
  RED.nodes.registerType('victron-input-vebus', BaseInputNode)

  // Output nodes
  RED.nodes.registerType('victron-output-accharger', BaseOutputNode)
  RED.nodes.registerType('victron-output-acsystem', BaseOutputNode)
  RED.nodes.registerType('victron-output-battery', BaseOutputNode)
  RED.nodes.registerType('victron-output-charger', BaseOutputNode)
  RED.nodes.registerType('victron-output-custom', BaseOutputNode)
  RED.nodes.registerType('victron-output-dcdc', BaseOutputNode)
  RED.nodes.registerType('victron-output-dess', BaseOutputNode)
  RED.nodes.registerType('victron-output-ess', BaseOutputNode)
  RED.nodes.registerType('victron-output-evcharger', BaseOutputNode)
  RED.nodes.registerType('victron-output-generator', BaseOutputNode)
  RED.nodes.registerType('victron-output-inverter', BaseOutputNode)
  RED.nodes.registerType('victron-output-multi', BaseOutputNode)
  RED.nodes.registerType('victron-output-pump', BaseOutputNode)
  RED.nodes.registerType('victron-output-pvinverter', BaseOutputNode)
  RED.nodes.registerType('victron-output-relay', BaseOutputNode)
  RED.nodes.registerType('victron-output-settings', BaseOutputNode)
  RED.nodes.registerType('victron-output-solarcharger', BaseOutputNode)
  RED.nodes.registerType('victron-output-switch', BaseOutputNode)
  RED.nodes.registerType('victron-output-vebus', BaseOutputNode)
}
