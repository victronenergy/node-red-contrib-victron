/* eslint-env jest */

jest.mock('dbus-native-victron', () => ({
  createClient: jest.fn(),
  systemBus: jest.fn(),
  sessionBus: jest.fn()
}))

const dbus = require('dbus-native-victron')
const victronNodesInitFunction = require('../src/nodes/victron-nodes')
const victronEventInitFunction = require('../src/nodes/victron-event')
const victronInjectInitFunction = require('../src/nodes/victron-inject')
const victronVirtualInitFunction = require('../src/nodes/victron-virtual')
const victronVirtualSwitchInitFunction = require('../src/nodes/victron-virtual-switch')
const victronVirtualIndicatorInitFunction = require('../src/nodes/victron-virtual-indicator')

const { NEEDS_NEWER_VERSION: REMOTE_GX_STATUS } = require('../src/services/utils')

function buildMockRED ({ configNodes = { 'victron-client-id': {} } } = {}) {
  const subscribe = jest.fn()
  const publish = jest.fn()
  const mockRED = {
    httpAdmin: { get: jest.fn() },
    settings: {},
    nodes: {
      registerType: jest.fn(),
      eachNode: jest.fn(),
      createNode: function (self, config) {
        self.id = config.id || 'node-1'
        self.name = config.name
        self.serviceObj = config.serviceObj
        self.pathObj = config.pathObj
        self.on = jest.fn()
        self.send = jest.fn()
        self.error = jest.fn()
        self.warn = jest.fn()
        self.log = jest.fn()
        self.context = jest.fn().mockReturnValue({ global: { set: jest.fn() } })
        self.status = jest.fn()
      },
      getNode: function (id) {
        if (!configNodes[id]) return null
        return {
          ...configNodes[id],
          addStatusListener: jest.fn(),
          client: {
            subscribe,
            publish,
            subscriptions: {},
            system: { cache: {} },
            onStatusUpdate: jest.fn(),
            client: { connected: true, getValue: jest.fn(), services: {} }
          },
          showValues: true
        }
      }
    }
  }
  return { mockRED, subscribe, publish }
}

function registeredType (initFn, mockRED, typeName) {
  initFn(mockRED)
  const call = mockRED.nodes.registerType.mock.calls.find(([name]) => name === typeName)
  return call[1]
}

function inputHandler (node) {
  const call = node.on.mock.calls.find(([event]) => event === 'input')
  return call && call[1]
}

const remoteConfigNodes = {
  'victron-client-id': {},
  'remote-config': { connectionType: 'ssh' }
}

const refusedCases = [
  ['a client other than victron-client-id', remoteConfigNodes, { client: 'remote-config' }],
  ['victron-client-id with connectionType ssh', { 'victron-client-id': { connectionType: 'ssh' } }, {}],
  ['victron-client-id with connectionType tcp', { 'victron-client-id': { connectionType: 'tcp' } }, { client: 'victron-client-id' }]
]

const allowedCases = [
  ['no client', { 'victron-client-id': {} }, {}],
  ['client victron-client-id', { 'victron-client-id': {} }, { client: 'victron-client-id' }],
  ['victron-client-id with connectionType auto', { 'victron-client-id': { connectionType: 'auto' } }, { client: 'victron-client-id' }]
]

function expectRefused (node) {
  expect(node.status).toHaveBeenCalledWith(REMOTE_GX_STATUS)
  expect(node.warn).toHaveBeenCalledTimes(1)
  expect(node.warn.mock.calls[0][0]).toMatch(/remote GX/)
}

const inputDefinition = {
  name: 'Test',
  service: 'com.victronenergy.battery/512',
  path: '/Soc',
  serviceObj: { name: 'Battery' },
  pathObj: { name: 'SoC', type: 'float' }
}

const outputDefinition = {
  name: 'Test',
  service: 'com.victronenergy.system/0',
  path: '/Relay/0/State',
  serviceObj: { name: 'System' },
  pathObj: { name: 'Relay 1 state', type: 'enum', enum: { 0: 'Open', 1: 'Closed' } }
}

describe('remote GX guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('input node', () => {
    it.each(refusedCases)('is refused for %s', (_, configNodes, extra) => {
      const { mockRED, subscribe } = buildMockRED({ configNodes })
      const BaseInputNode = registeredType(victronNodesInitFunction, mockRED, 'victron-input-battery')
      const node = new BaseInputNode({ ...inputDefinition, ...extra })
      expectRefused(node)
      expect(subscribe).not.toHaveBeenCalled()
    })

    it.each(allowedCases)('subscribes for %s', (_, configNodes, extra) => {
      const { mockRED, subscribe } = buildMockRED({ configNodes })
      const BaseInputNode = registeredType(victronNodesInitFunction, mockRED, 'victron-input-battery')
      const node = new BaseInputNode({ ...inputDefinition, ...extra })
      expect(node.status).not.toHaveBeenCalledWith(REMOTE_GX_STATUS)
      expect(subscribe).toHaveBeenCalled()
    })
  })

  describe('output node', () => {
    it.each(refusedCases)('is refused for %s', (_, configNodes, extra) => {
      const { mockRED, publish } = buildMockRED({ configNodes })
      const BaseOutputNode = registeredType(victronNodesInitFunction, mockRED, 'victron-output-relay')
      const node = new BaseOutputNode({ ...outputDefinition, ...extra })
      expectRefused(node)
      const handler = inputHandler(node)
      if (handler) handler.call(node, { payload: 1 })
      expect(publish).not.toHaveBeenCalled()
    })

    it.each(allowedCases)('publishes for %s', (_, configNodes, extra) => {
      const { mockRED, publish } = buildMockRED({ configNodes })
      const BaseOutputNode = registeredType(victronNodesInitFunction, mockRED, 'victron-output-relay')
      const node = new BaseOutputNode({ ...outputDefinition, ...extra })
      inputHandler(node).call(node, { payload: 1 })
      expect(node.status).not.toHaveBeenCalledWith(REMOTE_GX_STATUS)
      expect(publish).toHaveBeenCalled()
    })
  })

  describe.each([
    ['victron-event', victronEventInitFunction, { severity: 1, app: 'test' }, { payload: 'hello' }],
    ['victron-inject', victronInjectInitFunction, { notificationType: 2, notificationTitle: 'Title' }, { payload: 'hello' }]
  ])('%s node', (typeName, initFn, definition, msg) => {
    it.each(refusedCases)('is refused for %s', (_, configNodes, extra) => {
      const { mockRED, publish } = buildMockRED({ configNodes })
      const NodeType = registeredType(initFn, mockRED, typeName)
      const node = new NodeType({ ...definition, ...extra })
      expectRefused(node)
      const handler = inputHandler(node)
      if (handler) handler.call(node, msg)
      expect(publish).not.toHaveBeenCalled()
    })

    it.each(allowedCases)('publishes for %s', (_, configNodes, extra) => {
      const { mockRED, publish } = buildMockRED({ configNodes })
      const NodeType = registeredType(initFn, mockRED, typeName)
      const node = new NodeType({ ...definition, ...extra })
      inputHandler(node).call(node, msg)
      expect(node.status).not.toHaveBeenCalledWith(REMOTE_GX_STATUS)
      expect(publish).toHaveBeenCalled()
    })
  })

  describe.each([
    ['victron-virtual', victronVirtualInitFunction, { device: 'battery' }],
    ['victron-virtual-switch', victronVirtualSwitchInitFunction, {}],
    ['victron-virtual-indicator', victronVirtualIndicatorInitFunction, {}]
  ])('%s node', (typeName, initFn, definition) => {
    it.each(refusedCases)('does not connect to D-Bus for %s', (_, configNodes, extra) => {
      const { mockRED } = buildMockRED({ configNodes })
      const NodeType = registeredType(initFn, mockRED, typeName)
      const node = new NodeType({ ...definition, ...extra })
      expectRefused(node)
      expect(dbus.systemBus).not.toHaveBeenCalled()
      expect(dbus.createClient).not.toHaveBeenCalled()
      expect(dbus.sessionBus).not.toHaveBeenCalled()
    })

    it.each(allowedCases)('connects to D-Bus for %s', (_, configNodes, extra) => {
      const { mockRED } = buildMockRED({ configNodes })
      const NodeType = registeredType(initFn, mockRED, typeName)
      const node = new NodeType({ ...definition, ...extra })
      expect(node.status).not.toHaveBeenCalledWith(REMOTE_GX_STATUS)
      const connectCalls = dbus.systemBus.mock.calls.length + dbus.createClient.mock.calls.length + dbus.sessionBus.mock.calls.length
      expect(connectCalls).toBeGreaterThan(0)
    })
  })
})
