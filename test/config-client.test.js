jest.mock('../src/services/victron-client.js', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    onStatusUpdate: () => {},
    system: { cache: {} }
  }))
})

const configClientInitFunction = require('../src/nodes/config-client')
const utils = require('../src/services/utils.js')

function buildMockRED () {
  const registeredTypes = {}
  const mockRED = {
    httpAdmin: { get: jest.fn() },
    auth: { needsPermission: jest.fn() },
    nodes: {
      registerType: (type, fn) => { registeredTypes[type] = fn },
      createNode: (self, config) => { Object.assign(self, config) }
    }
  }
  configClientInitFunction(mockRED)
  return { ConfigVictronClient: registeredTypes['victron-client'], mockRED }
}

function routesOf (app) {
  return Object.fromEntries(app.get.mock.calls.map(([path, ...handlers]) => [path, handlers]))
}

describe('config-client editor endpoints', () => {
  // #576: the editor must reach these with relative URLs, which resolve under httpAdminRoot
  // (and under a reverse-proxy prefix such as Home Assistant ingress).
  it.each(['/victron/services/:service?', '/victron/cache'])('registers %s on httpAdmin', (path) => {
    const { mockRED } = buildMockRED()
    expect(routesOf(mockRED.httpAdmin)).toHaveProperty([path])
  })
})

describe('config-client status listeners', () => {
  it('removeStatusListener only removes the specified listener, leaving other nodes able to receive status updates', () => {
    const { ConfigVictronClient } = buildMockRED()
    const configNode = new ConfigVictronClient({})

    const nodeA = { status: jest.fn() }
    const nodeB = { status: jest.fn() }

    const idA = configNode.addStatusListener(nodeA, 'com.victronenergy.heatpump/40', '/State')
    configNode.addStatusListener(nodeB, 'com.victronenergy.switch/41', '/State')

    // clear the initial status() call every addStatusListener performs on registration
    nodeA.status.mockClear()
    nodeB.status.mockClear()

    configNode.removeStatusListener(idA)

    configNode.client.onStatusUpdate({ service: 'com.victronenergy.switch/41' }, utils.STATUS.SERVICE_REMOVE)

    expect(nodeB.status).toHaveBeenCalledWith(utils.DISCONNECTED)
  })
})
