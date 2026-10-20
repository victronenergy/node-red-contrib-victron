/* eslint-env jest */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { EventEmitter } = require('events')

// Runs the real victron-virtual node constructor against mocked D-Bus modules, to check what
// happens to the EV charger session timer across connect, reconnect and close.
jest.mock('dbus-native-victron', () => ({ createClient: jest.fn() }))
jest.mock('dbus-victron-virtual', () => ({ addSettings: jest.fn(), addVictronInterfaces: jest.fn() }))

const SETTINGS_RESULT = [null, ['evcharger:100']]
const CONFIG = { id: 'evcs1', device: 'evcs', evcs_charging_control: true, evcs_auto_session: true, default_values: true }

function mockBus () {
  const connection = new EventEmitter()
  connection.end = jest.fn()
  return {
    connection,
    exportInterface: jest.fn(),
    requestName: jest.fn(),
    releaseName: jest.fn((name, cb) => cb(null, 1)),
    invoke: jest.fn(),
    listNames: jest.fn(cb => cb(null, []))
  }
}

function createNode (persistLocation) {
  let Constructor
  const RED = {
    settings: { userDir: persistLocation, victronVirtual: { persistLocation } },
    httpAdmin: { get: jest.fn() },
    nodes: {
      registerType: jest.fn((type, ctor) => { Constructor = ctor }),
      createNode: jest.fn((node, config) => {
        const handlers = {}
        Object.assign(node, {
          id: config.id,
          handlers,
          on: (event, fn) => { handlers[event] = fn },
          status: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          send: jest.fn()
        })
      }),
      eachNode: jest.fn()
    }
  }
  require('../src/nodes/victron-virtual')(RED)
  const node = {}
  Constructor.call(node, CONFIG)
  return node
}

const flush = () => jest.advanceTimersByTimeAsync(0)

describe('EV charger session timer lifecycle', () => {
  let persistLocation, stops, dbus, addSettings, addVictronInterfaces, evcs

  beforeEach(() => {
    // index.js keeps module-level state (node instances, cleanup timer), so load it fresh per test
    jest.resetModules()
    dbus = require('dbus-native-victron')
    ;({ addSettings, addVictronInterfaces } = require('dbus-victron-virtual'))
    evcs = require('../src/nodes/victron-virtual/device-type/evcs')
    jest.useFakeTimers()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    process.env.NODE_RED_DBUS_ADDRESS = '127.0.0.1:7878'
    persistLocation = fs.mkdtempSync(path.join(os.tmpdir(), 'evcs-lifecycle-'))
    dbus.createClient.mockImplementation(() => mockBus())
    addVictronInterfaces.mockImplementation(() => ({ setValuesLocally: jest.fn(), emitS2Signal: jest.fn(), getValue: jest.fn(), removeSettings: jest.fn() }))
    stops = []
    jest.spyOn(evcs, 'startSessionTimer').mockImplementation(() => {
      const stop = jest.fn()
      stops.push(stop)
      return stop
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
    delete process.env.NODE_RED_DBUS_ADDRESS
    fs.rmSync(persistLocation, { recursive: true, force: true })
  })

  test('starts one timer once set up', async () => {
    addSettings.mockResolvedValue(SETTINGS_RESULT)
    createNode(persistLocation)
    await flush()
    expect(evcs.startSessionTimer).toHaveBeenCalledTimes(1)
  })

  test('does not start a timer when the node closed during setup', async () => {
    let resolveSettings
    addSettings.mockReturnValue(new Promise(resolve => { resolveSettings = resolve }))
    const node = createNode(persistLocation)
    await flush()

    node.handlers.close(jest.fn())
    resolveSettings(SETTINGS_RESULT)
    await flush()

    expect(evcs.startSessionTimer).not.toHaveBeenCalled()
  })

  test('stops the old timer on a reconnect, also when the new setup fails', async () => {
    addSettings.mockResolvedValueOnce(SETTINGS_RESULT)
    createNode(persistLocation)
    await flush()
    expect(stops).toHaveLength(1)

    addSettings.mockRejectedValueOnce(new Error('settings write failed'))
    dbus.createClient.mock.results[0].value.connection.emit('end')
    await jest.advanceTimersByTimeAsync(1000)

    expect(dbus.createClient).toHaveBeenCalledTimes(2)
    expect(stops[0]).toHaveBeenCalled()
  })

  test('stops the timer on close', async () => {
    addSettings.mockResolvedValue(SETTINGS_RESULT)
    const node = createNode(persistLocation)
    await flush()

    node.handlers.close(jest.fn())
    expect(stops[0]).toHaveBeenCalled()
  })
})

describe('EV charger session across a restart', () => {
  let persistLocation, evcs

  beforeEach(() => {
    jest.resetModules()
    const dbus = require('dbus-native-victron')
    const { addSettings, addVictronInterfaces } = require('dbus-victron-virtual')
    evcs = require('../src/nodes/victron-virtual/device-type/evcs')
    jest.useFakeTimers()
    process.env.NODE_RED_DBUS_ADDRESS = '127.0.0.1:7878'
    persistLocation = fs.mkdtempSync(path.join(os.tmpdir(), 'evcs-restart-'))
    dbus.createClient.mockImplementation(() => mockBus())
    addSettings.mockResolvedValue(SETTINGS_RESULT)
    addVictronInterfaces.mockImplementation(() => ({ setValuesLocally: jest.fn(), emitS2Signal: jest.fn(), getValue: jest.fn(), removeSettings: jest.fn() }))
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    delete process.env.NODE_RED_DBUS_ADDRESS
    fs.rmSync(persistLocation, { recursive: true, force: true })
  })

  test('a charger still charging after a restart continues its session', async () => {
    const saved = { Status: 2, 'Session/Energy': 5.2, 'Session/Time': 1200, ChargingTime: 1200 }
    fs.writeFileSync(path.join(persistLocation, `${CONFIG.id}.json`), JSON.stringify({ state: saved }))
    const node = createNode(persistLocation)
    await jest.advanceTimersByTimeAsync(0)

    const changes = evcs.onPropertiesChanged({ changes: { Status: 2 }, instance: node.iface, config: CONFIG })
    Object.assign(node.iface, changes)

    expect(node.iface).toMatchObject({ 'Session/Energy': 5.2, 'Session/Time': 1200, ChargingTime: 1200 })
  })
})
