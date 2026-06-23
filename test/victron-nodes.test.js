const victronNodesInitFunction = require('../src/nodes/victron-nodes')
const { serviceNamesWithoutDeviceInstance } = require('../src/services/dbus-listener')

function buildMockRED ({ services = {}, connected = true, hasConfigNode = true } = {}) {
  const subscribe = jest.fn()
  const mockRED = {
    nodes: {
      registerType: jest.fn(),
      createNode: function (self, config) {
        self.name = config.name
        self.serviceObj = config.serviceObj
        self.pathObj = config.pathObj
        self.on = jest.fn()
        self.send = jest.fn()
        self.error = jest.fn()
        self.context = jest.fn().mockReturnValue({ global: { set: jest.fn() } })
        self.status = jest.fn()
      },
      getNode: function (id) {
        if (id === 'victron-client-id' && hasConfigNode) {
          return {
            addStatusListener: jest.fn(),
            client: {
              subscribe,
              subscriptions: {},
              system: { cache: {} },
              onStatusUpdate: jest.fn(),
              client: { connected, getValue: jest.fn(), services }
            },
            showValues: true
          }
        }
        return null
      }
    }
  }
  victronNodesInitFunction(mockRED)
  const BaseInputNode = mockRED.nodes.registerType.mock.calls[0][1]
  const outputCallIndex = mockRED.nodes.registerType.mock.calls.findIndex(c => c[0].startsWith('victron-output-'))
  const BaseOutputNode = mockRED.nodes.registerType.mock.calls[outputCallIndex][1]
  return { mockRED, BaseInputNode, BaseOutputNode, subscribe }
}

describe('victron-nodes migration', () => {
  it('skips migration for services in serviceNamesWithoutDeviceInstance', () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    const { BaseInputNode } = buildMockRED()

    const settingsNode = new BaseInputNode({
      name: 'Test',
      service: 'com.victronenergy.settings',
      path: '/Settings/Foo',
      serviceObj: { name: 'Settings' },
      pathObj: { name: 'Foo' }
    })
    expect(settingsNode).toBeDefined()

    const migrationTimers = setTimeoutSpy.mock.calls.filter(
      ([fn]) => fn.name === 'migrateSubscriptions'
    )
    expect(migrationTimers).toHaveLength(0)
    setTimeoutSpy.mockRestore()
  })

  it('does not crash when deviceInstance is null in the services cache', () => {
    jest.useFakeTimers()
    try {
      const { BaseInputNode } = buildMockRED({
        services: {
          'com.victronenergy.battery': { name: 'com.victronenergy.battery', deviceInstance: null }
        }
      })

      const batteryNode = new BaseInputNode({
        name: 'Test',
        service: 'com.victronenergy.battery.512',
        path: '/Soc',
        serviceObj: { name: 'Battery' },
        pathObj: { name: 'SoC' }
      })
      expect(batteryNode).toBeDefined()

      expect(() => jest.runAllTimers()).not.toThrow()
    } finally {
      jest.useRealTimers()
    }
  })

  it('serviceNamesWithoutDeviceInstance contains com.victronenergy.settings', () => {
    expect(serviceNamesWithoutDeviceInstance).toContain('com.victronenergy.settings')
  })
})

describe('victron-nodes missing config node', () => {
  it('does not crash when no config node exists (e.g. AI-generated flow import)', () => {
    const { BaseInputNode, BaseOutputNode } = buildMockRED({ hasConfigNode: false })

    const nodeDef = {
      name: 'Grid Status',
      service: 'com.victronenergy.system/0',
      path: '/Ac/Grid/0/Connected',
      serviceObj: { name: 'System' },
      pathObj: { name: 'Grid Connected' }
    }

    let inputNode
    expect(() => { inputNode = new BaseInputNode(nodeDef) }).not.toThrow()
    expect(inputNode.status).toHaveBeenCalledWith(expect.objectContaining({ fill: 'red' }))

    let outputNode
    expect(() => {
      outputNode = new BaseOutputNode({
        name: 'Relay',
        service: 'com.victronenergy.system/0',
        path: '/Relay/0/State',
        serviceObj: { name: 'System' },
        pathObj: { name: 'Relay State', type: 'integer' }
      })
    }).not.toThrow()
    expect(outputNode.status).toHaveBeenCalledWith(expect.objectContaining({ fill: 'red' }))
  })
})

describe('victron-nodes', () => {
  it('allows me to instantiate a node and set values', () => {
    // We imitate the behaviour of node-red here, as we cannot access the method
    // handleStatus from node-red's Flow.js here.
    const handleStatus = jest.fn(function (_node, message, _reportingNode, _muteStatusEvent) {
      if (Object.prototype.hasOwnProperty.call(message, 'text') && typeof message.text !== 'string') {
        message.text = message.text.toString()
      }
    })

    // the subscribe handler of our BasicInputNode writes to the global context,
    // so we need to mock that.
    const globalContext = {
      set: jest.fn()
    }

    const registerType = jest.fn()

    // we mock the createNode function of the RED object
    const createNode = function (self, config) {
      self.name = config.name
      self.serviceObj = config.serviceObj
      self.pathObj = config.pathObj

      self.on = jest.fn()
      self.send = jest.fn()

      self.context = jest.fn().mockReturnValue({
        global: globalContext
      })

      self.status = jest.fn((message) => {
        handleStatus(self, message, self, false)
      })
    }

    const subscribe = jest.fn()

    const getNodeFn = function getNode (id) {
      if (id === 'victron-client-id') {
        return {
          addStatusListener: jest.fn(),
          client: {
            subscribe,
            client: {
              // see how we call migrateSubscriptions in victron-nodes.js to understand why we do this:
              // If we don't, the unit test will hang.
              connected: true,
              getValue: jest.fn(),
              services: {}
            }
          },
          showValues: true
        }
      }
      throw new Error('[mock getNode] Node not found: ' + id)
    }

    // we mock the RED object that is passed to the init function
    const mockRED = {
      nodes: {
        registerType,
        createNode,
        getNode: getNodeFn
      }
    }

    // now we can call the init function of the victron-nodes, our function under test
    victronNodesInitFunction(mockRED)

    expect(registerType.mock.calls.length).toBeGreaterThan(0)
    expect(registerType.mock.calls[0][0]).toEqual('victron-input-accharger')

    expect(registerType.mock.calls[0][1]).toBeInstanceOf(Function)

    // we can now instantiate a BaseInputNode
    const BaseInputNode = registerType.mock.calls[0][1]

    const node = new BaseInputNode({
      name: 'Test Node',
      service: 'my-service',
      path: 'my-path',
      serviceObj: {
        name: 'Test Service'
      },
      pathObj: {
        name: 'Test Path'
      },
      on: 42
    })

    expect(subscribe.mock.calls.length).toBe(1)
    expect(subscribe.mock.calls[0][0]).toEqual('my-service')
    expect(node).toBeDefined()

    // now we can send a message to the node
    subscribe.mock.calls[0][2]({
      value: 42
    })

    // we expect the node to send a message
    expect(node.send.mock.calls.length).toBe(1)
    expect(node.send.mock.calls[0][0].payload).toEqual(42)
    expect(node.send.mock.calls[0][0].topic).toEqual('Test Node')

    // ... and we expect the status to be set
    expect(handleStatus.mock.calls.length).toBe(1)
    expect(handleStatus.mock.calls[0][1].text).toEqual('42')

    // now we set a null value
    subscribe.mock.calls[0][2]({
      value: null
    })

    // we expect the node to send a message with null payload
    expect(node.send.mock.calls.length).toBe(2)
    expect(node.send.mock.calls[1][0].payload).toEqual(null)
    expect(node.send.mock.calls[1][0].topic).toEqual('Test Node')

    // ... and we expect the status to be set to 'null'
    expect(handleStatus.mock.calls.length).toBe(2)
    expect(handleStatus.mock.calls[1][1].text).toEqual('null')
  })
})

describe('victron-nodes', () => {
  it('maps service names, if name is in mappings', () => {
    const { BaseInputNode } = buildMockRED()

    const oldStyleSystemInputNode = new BaseInputNode({
      name: 'Test',
      service: 'com.victronenergy.system/0',
      path: '/SomePath/Foo',
      serviceObj: { name: 'SomePath' },
      pathObj: { name: 'Foo' }
    })
    expect(oldStyleSystemInputNode).toBeDefined()
    expect(oldStyleSystemInputNode.service).toEqual('com.victronenergy.system')
  })
})
