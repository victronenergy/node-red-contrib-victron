jest.mock('../src/services/victron-client.js', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    onStatusUpdate: () => {},
    system: { cache: {} }
  }))
})

const VictronClient = require('../src/services/victron-client.js')
const configClientInitFunction = require('../src/nodes/config-client')
const utils = require('../src/services/utils.js')

// runtimeLike: like Node-RED's createNode, don't copy config properties onto the node instance
function buildMockRED ({ runtimeLike = false } = {}) {
  const registeredTypes = {}
  const instances = {}
  const mockRED = {
    httpAdmin: { get: jest.fn() },
    auth: { needsPermission: jest.fn() },
    nodes: {
      registerType: (type, fn) => { registeredTypes[type] = fn },
      createNode: runtimeLike
        ? (self, config) => { self.id = config.id; instances[config.id] = self }
        : (self, config) => { Object.assign(self, config) },
      getNode: (id) => instances[id] || null
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
    const configNode = new ConfigVictronClient({ id: 'victron-client-id' })

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

describe('config-client remote GX guard', () => {
  beforeEach(() => {
    VictronClient.mockClear()
  })

  it.each([
    [undefined, false],
    ['auto', false],
    ['ssh', true],
    ['tcp', true]
  ])('with connectionType %s, isRemoteClient is %s for nodes on victron-client-id', (connectionType, expected) => {
    const { ConfigVictronClient, mockRED } = buildMockRED({ runtimeLike: true })
    new ConfigVictronClient({ id: 'victron-client-id', connectionType }) // eslint-disable-line no-new
    expect(utils.isRemoteClient(mockRED, {})).toBe(expected)
  })

  it('keeps status updates going to local nodes when a remote config node is also deployed', () => {
    const { ConfigVictronClient } = buildMockRED({ runtimeLike: true })
    const localConfig = new ConfigVictronClient({ id: 'victron-client-id' })
    new ConfigVictronClient({ id: 'remote-config', connectionType: 'ssh' }) // eslint-disable-line no-new

    const localNode = { status: jest.fn() }
    localConfig.addStatusListener(localNode, 'com.victronenergy.battery/512', '/Soc')
    localNode.status.mockClear()

    localConfig.client.onStatusUpdate({ service: 'com.victronenergy.battery/512' }, utils.STATUS.SERVICE_REMOVE)

    expect(localNode.status).toHaveBeenCalledWith(utils.DISCONNECTED)
  })

  it('does not let a remote config node create the local client', () => {
    const { ConfigVictronClient } = buildMockRED({ runtimeLike: true })
    new ConfigVictronClient({ id: 'remote-config', connectionType: 'ssh', enablePolling: true }) // eslint-disable-line no-new
    new ConfigVictronClient({ id: 'victron-client-id', enablePolling: false }) // eslint-disable-line no-new

    expect(VictronClient).toHaveBeenCalledTimes(1)
    expect(VictronClient.mock.calls[0][1]).toEqual({ enablePolling: false })
  })
})
