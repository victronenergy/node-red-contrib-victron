const victronNodesInitFunction = require('../src/nodes/victron-nodes')
const { serviceNamesWithoutDeviceInstance } = require('../src/services/dbus-listener')

function buildMockRED ({ services = {}, connected = true, hasConfigNode = true, initFn = victronNodesInitFunction } = {}) {
  const subscribe = jest.fn()
  const publish = jest.fn()
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
        self.warn = jest.fn()
        self.context = jest.fn().mockReturnValue({ global: { set: jest.fn() } })
        self.status = jest.fn()
      },
      getNode: function (id) {
        if (id === 'victron-client-id' && hasConfigNode) {
          return {
            addStatusListener: jest.fn(),
            client: {
              subscribe,
              publish,
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
  initFn(mockRED)
  const BaseInputNode = mockRED.nodes.registerType.mock.calls[0][1]
  const outputCallIndex = mockRED.nodes.registerType.mock.calls.findIndex(c => c[0].startsWith('victron-output-'))
  const BaseOutputNode = mockRED.nodes.registerType.mock.calls[outputCallIndex][1]
  return { mockRED, BaseInputNode, BaseOutputNode, subscribe, publish }
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

describe('victron-nodes pathObj guard', () => {
  it('BaseInputNode does not crash and still emits value when pathObj is undefined', () => {
    const { BaseInputNode, subscribe } = buildMockRED()

    const node = new BaseInputNode({
      name: 'Test',
      service: 'com.victronenergy.battery',
      path: '/Soc',
      serviceObj: { name: 'Battery' },
      pathObj: undefined
    })

    const processMessage = subscribe.mock.calls[0][2]
    expect(() => processMessage({ value: 42 })).not.toThrow()
    expect(node.send).toHaveBeenCalledWith(expect.objectContaining({ payload: 42 }))
  })

  it('BaseOutputNode shows error status and does not publish when pathObj is undefined', () => {
    const { BaseOutputNode, publish } = buildMockRED()

    const node = new BaseOutputNode({
      name: 'Test',
      service: 'com.victronenergy.system',
      path: '/Relay/0/State',
      serviceObj: { name: 'System' },
      pathObj: undefined
    })

    const inputHandler = node.on.mock.calls.find(c => c[0] === 'input')[1]
    inputHandler({ payload: 1 })

    expect(node.status).toHaveBeenCalledWith(expect.objectContaining({ fill: 'red' }))
    expect(publish).not.toHaveBeenCalled()
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

describe('victron-nodes global context regression (#535)', () => {
  it('writes both the bare and legacy "_0" global context keys for singleton services', () => {
    const { BaseInputNode, subscribe } = buildMockRED()

    const node = new BaseInputNode({
      name: 'Test',
      service: 'com.victronenergy.system',
      path: '/Serial',
      serviceObj: { name: 'System' },
      pathObj: { name: 'Serial' }
    })

    const globalContext = node.context().global
    const processMessage = subscribe.mock.calls[0][2]
    processMessage({ value: 'abc123' })

    expect(globalContext.set).toHaveBeenCalledWith('victronenergy.system.Serial', 'abc123')
    expect(globalContext.set).toHaveBeenCalledWith('victronenergy.system._0.Serial', 'abc123')
  })

  it('writes only a single global context key for non-singleton services', () => {
    const { BaseInputNode, subscribe } = buildMockRED()

    const node = new BaseInputNode({
      name: 'Test',
      service: 'com.victronenergy.battery/512',
      path: '/Soc',
      serviceObj: { name: 'Battery' },
      pathObj: { name: 'SoC' }
    })

    const globalContext = node.context().global
    const processMessage = subscribe.mock.calls[0][2]
    processMessage({ value: 55 })

    expect(globalContext.set).toHaveBeenCalledTimes(1)
    expect(globalContext.set).toHaveBeenCalledWith('victronenergy.battery._512.Soc', 55)
  })

  it('logs the legacy key deprecation warning only once, even across multiple nodes', () => {
    let freshInitFn
    jest.isolateModules(() => {
      freshInitFn = require('../src/nodes/victron-nodes')
    })

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const emitOnce = (path) => {
        const { BaseInputNode, subscribe } = buildMockRED({ initFn: freshInitFn })
        new BaseInputNode({ // eslint-disable-line no-new
          name: 'Test',
          service: 'com.victronenergy.system',
          path,
          serviceObj: { name: 'System' },
          pathObj: { name: path }
        })
        subscribe.mock.calls[0][2]({ value: 'x' })
      }

      emitOnce('/Serial')
      emitOnce('/ProductName')

      const legacyWarnings = warnSpy.mock.calls.filter(([msg]) => msg.includes('[DEPRECATED]'))
      expect(legacyWarnings).toHaveLength(1)
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('victron-nodes output feedback loop warning (#574)', () => {
  const relayDef = {
    name: 'Relay',
    service: 'com.victronenergy.system',
    path: '/Relay/1/State',
    serviceObj: { name: 'System' },
    pathObj: { name: 'Relay State', type: 'enum', enum: { 0: 'Open', 1: 'Closed' } }
  }

  // Sends msgs to the node's input handler, advancing the clock by intervalMs before each
  function writeSequence (node, payloads, intervalMs, path) {
    const inputHandler = node.on.mock.calls.find(c => c[0] === 'input')[1]
    payloads.forEach(payload => {
      jest.advanceTimersByTime(intervalMs)
      inputHandler(path ? { payload, path } : { payload })
    })
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-13T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('warns when the written value keeps flipping within a second, and still publishes every write', () => {
    const { BaseOutputNode, publish } = buildMockRED()
    const node = new BaseOutputNode(relayDef)

    writeSequence(node, [1, 0, 1, 0, 1, 0, 1, 0], 30)

    expect(node.warn).toHaveBeenCalledTimes(1)
    expect(node.warn.mock.calls[0][0]).toMatch(/feedback loop/i)
    expect(node.warn.mock.calls[0][0]).toContain('/Relay/1/State')
    expect(publish).toHaveBeenCalledTimes(8)
  })

  it('does not warn when the same value is written rapidly', () => {
    const { BaseOutputNode } = buildMockRED()
    const node = new BaseOutputNode(relayDef)

    writeSequence(node, Array(20).fill(1), 30)

    expect(node.warn).not.toHaveBeenCalled()
  })

  it('does not warn for a few quick changes', () => {
    const { BaseOutputNode } = buildMockRED()
    const node = new BaseOutputNode(relayDef)

    writeSequence(node, [1, 0, 1, 0], 30)

    expect(node.warn).not.toHaveBeenCalled()
  })

  it('does not warn when values alternate slower than the detection window allows', () => {
    const { BaseOutputNode } = buildMockRED()
    const node = new BaseOutputNode(relayDef)

    writeSequence(node, [1, 0, 1, 0, 1, 0, 1, 0, 1, 0], 300)

    expect(node.warn).not.toHaveBeenCalled()
  })

  it('warns at most once per minute while the loop continues', () => {
    const { BaseOutputNode } = buildMockRED()
    const node = new BaseOutputNode(relayDef)

    // 30s of continuous flipping
    writeSequence(node, Array.from({ length: 1000 }, (_, i) => i % 2), 30)
    expect(node.warn).toHaveBeenCalledTimes(1)

    // another 40s: past the one-minute mark
    writeSequence(node, Array.from({ length: 1334 }, (_, i) => i % 2), 30)
    expect(node.warn).toHaveBeenCalledTimes(2)
  })

  it('tracks each msg.path separately', () => {
    const { BaseOutputNode } = buildMockRED()
    const node = new BaseOutputNode(relayDef)
    const inputHandler = node.on.mock.calls.find(c => c[0] === 'input')[1]

    // Alternating between two paths, each always receiving the same value
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(30)
      inputHandler({ payload: 1, path: '/Relay/0/State' })
      jest.advanceTimersByTime(30)
      inputHandler({ payload: 0, path: '/Relay/1/State' })
    }

    expect(node.warn).not.toHaveBeenCalled()
  })

  it('does not count writes that fail validation', () => {
    const { BaseOutputNode, publish } = buildMockRED()
    const node = new BaseOutputNode(relayDef)

    writeSequence(node, [1, 'x', 1, 'x', 1, 'x', 1, 'x'], 30)

    expect(node.warn).not.toHaveBeenCalled()
    expect(publish).toHaveBeenCalledTimes(4)
  })

  it('still publishes object payloads that cannot be serialized', () => {
    const { BaseOutputNode, publish } = buildMockRED()
    const node = new BaseOutputNode({ ...relayDef, path: '/Settings', pathObj: { name: 'Settings', type: 'object' } })
    const circular = { a: 1 }
    circular.self = circular

    expect(() => writeSequence(node, [circular, { big: 1n }], 30)).not.toThrow()
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('forgets the last value of a path that has not been written for longer than the detection window', () => {
    const { BaseOutputNode } = buildMockRED()
    const node = new BaseOutputNode(relayDef)
    const inputHandler = node.on.mock.calls.find(c => c[0] === 'input')[1]

    inputHandler({ payload: 1 })
    jest.advanceTimersByTime(2000)
    // Writing a new path prunes the stale /Relay/1/State entry
    inputHandler({ payload: 1, path: '/Relay/0/State' })

    // Had the stale value 1 been kept, the first 0 would count as a change, making 5
    writeSequence(node, [0, 1, 0, 1, 0], 30)

    expect(node.warn).not.toHaveBeenCalled()
  })
})
