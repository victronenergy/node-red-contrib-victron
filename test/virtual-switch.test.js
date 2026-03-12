// test/virtual-switch.test.js
const { emitInitialSwitchOutputs } = require('../src/services/virtual-switch')
const { SWITCH_TYPE_MAP } = require('../src/nodes/victron-virtual-constants')

function makeNode (ifaceOverrides = {}, ifaceDescOverrides = {}) {
  const iface = {
    DeviceInstance: 42,
    'SwitchableOutput/output_1/State': 1,
    'SwitchableOutput/output_1/Auto': 0,
    'SwitchableOutput/output_1/Dimming': 50,
    ...ifaceOverrides
  }

  const stateFormat = (v) => ({ 0: 'Off', 1: 'On' }[v] || 'unknown')
  const autoFormat = (v) => (v === 1 ? 'Auto' : 'Manual')
  const dimmingFormat = (v) => (v != null ? v.toFixed(1) + '%' : '')

  const ifaceDesc = {
    properties: {
      'SwitchableOutput/output_1/State': { type: 'i', format: stateFormat },
      'SwitchableOutput/output_1/Auto': { type: 'i', format: autoFormat },
      'SwitchableOutput/output_1/Dimming': { type: 'd', format: dimmingFormat },
      ...ifaceDescOverrides
    }
  }

  return {
    iface,
    ifaceDesc,
    status: jest.fn(),
    send: jest.fn(),
    name: 'Test switch',
    lastSentValues: {}
  }
}

describe('emitInitialSwitchOutputs', () => {
  test('toggle switch emits State on output 2', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 1 })
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node)
    expect(node.send).toHaveBeenCalledWith([
      null,
      { payload: 1, topic: 'Test switch/state', source_path: '/SwitchableOutput/output_1/State' }
    ])
  })

  test('three-state switch emits State on output 2 and Auto mode on output 3', () => {
    const node = makeNode({
      'SwitchableOutput/output_1/State': 1,
      'SwitchableOutput/output_1/Auto': 0
    })
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.THREE_STATE, outputs: 3 }, node)
    expect(node.send).toHaveBeenCalledWith([
      null,
      { payload: 1, topic: 'Test switch/state', source_path: '/SwitchableOutput/output_1/State' },
      { payload: 0, topic: 'Test switch/auto', source_path: '/SwitchableOutput/output_1/Auto' }
    ])
  })

  test('temperature setpoint emits Dimming on output 2 (no State output)', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/Dimming': 21.5 })
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT, outputs: 2 }, node)
    expect(node.send).toHaveBeenCalledWith([
      null,
      { payload: 21.5, topic: 'Test switch/temperature', source_path: '/SwitchableOutput/output_1/Dimming' }
    ])
  })

  test('dimmable switch emits State on output 2 and Dimming on output 3', () => {
    const node = makeNode({
      'SwitchableOutput/output_1/State': 1,
      'SwitchableOutput/output_1/Dimming': 75
    })
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.DIMMABLE, outputs: 3 }, node)
    expect(node.send).toHaveBeenCalledWith([
      null,
      { payload: 1, topic: 'Test switch/state', source_path: '/SwitchableOutput/output_1/State' },
      { payload: 75, topic: 'Test switch/dimming', source_path: '/SwitchableOutput/output_1/Dimming' }
    ])
  })

  test('does nothing when outputs <= 1', () => {
    const node = makeNode()
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 1 }, node)
    expect(node.send).not.toHaveBeenCalled()
  })

  test('does nothing when iface is missing', () => {
    const node = { iface: null, send: jest.fn(), name: 'x', lastSentValues: {} }
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node)
    expect(node.send).not.toHaveBeenCalled()
  })

  test('uses fallback name when node.name is empty', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 0 })
    node.name = ''
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node)
    expect(node.send).toHaveBeenCalledWith([
      null,
      expect.objectContaining({ topic: 'Virtual switch/state' })
    ])
  })
})
