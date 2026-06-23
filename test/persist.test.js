// test/persist.test.js
/* eslint-env jest */

describe('flushPersistedState', () => {
  const RED = { settings: { userDir: '/tmp/test' } }
  const id = 'test-node-id'
  const ifaceDesc = {
    properties: {
      'Ac/Energy/Forward': { type: 'd', persist: 60 }
    }
  }

  beforeEach(() => {
    jest.resetModules()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  function setup () {
    jest.mock('fs', () => ({
      existsSync: jest.fn(() => false),
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
      renameSync: jest.fn(),
      readFileSync: jest.fn()
    }))
    const fs = require('fs')
    const persist = require('../src/nodes/persist')
    return { fs, persist }
  }

  test('is exported from persist.js', () => {
    const { persist } = setup()
    expect(typeof persist.flushPersistedState).toBe('function')
  })

  test('cancels a pending throttle timer and writes immediately', () => {
    const { fs, persist } = setup()
    const { savePersistedState, flushPersistedState } = persist
    const iface = { 'Ac/Energy/Forward': 1.5 }

    // Initial save primes the cache and sets lastSaveAt
    savePersistedState(RED, id, iface, ifaceDesc)

    // Change value so isSaveNeeded returns true on next call
    iface['Ac/Energy/Forward'] = 2.0

    // Second save within 60s throttle window - queues a timer, does not write now
    savePersistedState(RED, id, iface, ifaceDesc, 'Ac/Energy/Forward')
    const writesBefore = fs.writeFileSync.mock.calls.length

    // Flush must cancel the timer and write immediately
    flushPersistedState(RED, id, iface, ifaceDesc)
    expect(fs.writeFileSync.mock.calls.length).toBeGreaterThan(writesBefore)
  })

  test('is a no-op when there is no pending timer', () => {
    const { fs, persist } = setup()
    const { flushPersistedState } = persist
    const iface = { 'Ac/Energy/Forward': 1.5 }

    expect(() => flushPersistedState(RED, id, iface, ifaceDesc)).not.toThrow()
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  test('does not fire the timer after flush', () => {
    const { fs, persist } = setup()
    const { savePersistedState, flushPersistedState } = persist
    const iface = { 'Ac/Energy/Forward': 1.5 }

    savePersistedState(RED, id, iface, ifaceDesc)
    iface['Ac/Energy/Forward'] = 3.0
    savePersistedState(RED, id, iface, ifaceDesc, 'Ac/Energy/Forward')
    flushPersistedState(RED, id, iface, ifaceDesc)

    const writesAfterFlush = fs.writeFileSync.mock.calls.length
    jest.runAllTimers() // timer was cancelled - no additional writes
    expect(fs.writeFileSync.mock.calls.length).toBe(writesAfterFlush)
  })
})
