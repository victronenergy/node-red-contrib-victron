/* eslint-env jest */
const virtualInitFunction = require('../src/nodes/victron-virtual')

function buildMockRED () {
  const mockRED = {
    httpAdmin: { get: jest.fn() },
    httpNode: { get: jest.fn() },
    nodes: { registerType: jest.fn() }
  }
  virtualInitFunction(mockRED)
  return mockRED
}

function handlersFor (app, path) {
  const call = app.get.mock.calls.find(([p]) => p === path)
  return call && call.slice(1)
}

describe('victron-virtual editor endpoints', () => {
  // #576: the editor reaches this with a relative URL, which resolves under httpAdminRoot
  // (and under a reverse-proxy prefix such as Home Assistant ingress).
  it('registers /victron/virtual-device-types on httpAdmin', () => {
    const mockRED = buildMockRED()
    expect(handlersFor(mockRED.httpAdmin, '/victron/virtual-device-types')).toBeDefined()
  })

  it('keeps /victron/virtual-device-types on httpNode with the same handler', () => {
    const mockRED = buildMockRED()
    expect(handlersFor(mockRED.httpNode, '/victron/virtual-device-types'))
      .toEqual(handlersFor(mockRED.httpAdmin, '/victron/virtual-device-types'))
  })
})
