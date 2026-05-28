// test/virtual-switch.test.js
const { updateSwitchStatus, emitInitialSwitchOutputs, handleSwitchOutputs, createSwitchProperties, expandSwitchPayload, shouldApplyPayloadToDBus } = require('../src/services/virtual-switch')
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

describe('updateSwitchStatus', () => {
  test('toggle switch shows State (42)', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 1 })
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node)
    expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'On (42)' })
  })

  test('toggle switch shows Off state', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 0 })
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node)
    expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'Off (42)' })
  })

  test('three-state switch shows State | Auto mode (42)', () => {
    const node = makeNode({
      'SwitchableOutput/output_1/State': 1,
      'SwitchableOutput/output_1/Auto': 1
    })
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.THREE_STATE, outputs: 3 }, node)
    expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'On | Auto (42)' })
  })

  test('three-state switch shows Manual when Auto=0', () => {
    const node = makeNode({
      'SwitchableOutput/output_1/State': 0,
      'SwitchableOutput/output_1/Auto': 0
    })
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.THREE_STATE, outputs: 3 }, node)
    expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'Off | Manual (42)' })
  })

  test('bilge pump shows State | Status (42)', () => {
    const STATUS_BIT_NAMES = ['Powered', 'Tripped', 'Over temperature', 'Output fault', 'Short fault', 'Disabled', 'Bypassed', 'Ext. control']
    const node = makeNode(
      { 'SwitchableOutput/output_1/State': 1, 'SwitchableOutput/output_1/Status': 1 },
      { 'SwitchableOutput/output_1/Status': { type: 'i', format: (v) => v == null || v === 0 ? 'Off' : v === 0x09 ? 'On' : STATUS_BIT_NAMES.filter((_, i) => v & (1 << i)).join(', ') || String(v) } }
    )
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.BILGE_PUMP, outputs: 3 }, node)
    expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'On | Powered (42)' })
  })

  test('dimmable switch shows State | Dimming (42)', () => {
    const node = makeNode({
      'SwitchableOutput/output_1/State': 1,
      'SwitchableOutput/output_1/Dimming': 75
    })
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.DIMMABLE, outputs: 3 }, node)
    expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: 'On | 75.0% (42)' })
  })

  test('temperature setpoint shows Dimming value only (42)', () => {
    const node = makeNode({
      'SwitchableOutput/output_1/Dimming': 21.5
    }, {
      'SwitchableOutput/output_1/Dimming': { type: 'd', format: (v) => v != null ? v.toFixed(1) + '°C' : '' }
    })
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT, outputs: 2 }, node)
    expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: '21.5°C (42)' })
  })

  test('basic slider shows value with unit (42)', () => {
    const node = makeNode({
      'SwitchableOutput/output_1/Dimming': 42,
      'SwitchableOutput/output_1/Settings/Unit': 'RPM'
    })
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.BASIC_SLIDER, outputs: 2 }, node)
    expect(node.status).toHaveBeenCalledWith({ fill: 'green', shape: 'dot', text: '42.0RPM (42)' })
  })

  test('does nothing when iface is missing', () => {
    const node = { iface: null, ifaceDesc: {}, status: jest.fn() }
    updateSwitchStatus({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node)
    expect(node.status).not.toHaveBeenCalled()
  })
})

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

  test('bilge pump emits State with msg.status on output 2', () => {
    const node = makeNode({
      'SwitchableOutput/output_1/State': 0,
      'SwitchableOutput/output_1/Status': 3
    })
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.BILGE_PUMP, outputs: 2 }, node)
    expect(node.send).toHaveBeenCalledWith([
      null,
      {
        payload: 0,
        topic: 'Test switch/state',
        source_path: '/SwitchableOutput/output_1/State',
        status: { value: 3, powered: true, tripped: true, overTemperature: false, outputFault: false, shortFault: false, disabled: false, bypassed: false, externalControl: false }
      }
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

  test('seeds lastSentValues so handleSwitchOutputs does not re-emit on first call', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 1 })
    node.lastSentValues = {}
    emitInitialSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node)
    node.send.mockClear()
    // Same state, no propName - handleSwitchOutputs should not re-emit
    handleSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node, 'SwitchableOutput/output_1/State', 1)
    expect(node.send).not.toHaveBeenCalled()
  })
})

describe('handleSwitchOutputs', () => {
  test('does nothing when outputs <= 1', () => {
    const node = makeNode()
    handleSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 1 }, node, 'SwitchableOutput/output_1/State', 1)
    expect(node.send).not.toHaveBeenCalled()
  })

  test('toggle switch emits State change on output 2', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 1 })
    handleSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }, node, 'SwitchableOutput/output_1/State', 1)
    expect(node.send).toHaveBeenCalledWith([
      null,
      { payload: 1, topic: 'Test switch/state', source_path: '/SwitchableOutput/output_1/State' }
    ])
  })

  test('toggle switch does not re-emit unchanged State', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 1 })
    const config = { switch_1_type: SWITCH_TYPE_MAP.TOGGLE, outputs: 2 }
    handleSwitchOutputs(config, node, 'SwitchableOutput/output_1/State', 1)
    node.send.mockClear()
    handleSwitchOutputs(config, node, 'SwitchableOutput/output_1/State', 1)
    expect(node.send).not.toHaveBeenCalled()
  })

  test('dimmable switch emits Dimming change on output 3', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 1, 'SwitchableOutput/output_1/Dimming': 75 })
    handleSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.DIMMABLE, outputs: 3 }, node, 'SwitchableOutput/output_1/Dimming', 75)
    expect(node.send).toHaveBeenCalledWith([
      null,
      { payload: 1, topic: 'Test switch/state', source_path: '/SwitchableOutput/output_1/State' },
      { payload: 75, topic: 'Test switch/dimming', source_path: '/SwitchableOutput/output_1/Dimming' }
    ])
  })

  test('three-state switch emits Auto change on output 3', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/State': 1, 'SwitchableOutput/output_1/Auto': 1 })
    handleSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.THREE_STATE, outputs: 3 }, node, 'SwitchableOutput/output_1/Auto', 1)
    expect(node.send).toHaveBeenCalledWith([
      null,
      { payload: 1, topic: 'Test switch/state', source_path: '/SwitchableOutput/output_1/State' },
      { payload: 1, topic: 'Test switch/auto', source_path: '/SwitchableOutput/output_1/Auto' }
    ])
  })

  test('temperature setpoint emits Dimming on output 2', () => {
    const node = makeNode({ 'SwitchableOutput/output_1/Dimming': 21.5 })
    handleSwitchOutputs({ switch_1_type: SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT, outputs: 2 }, node, 'SwitchableOutput/output_1/Dimming', 21.5)
    expect(node.send).toHaveBeenCalledWith([
      null,
      { payload: 21.5, topic: 'Test switch/temperature', source_path: '/SwitchableOutput/output_1/Dimming' }
    ])
  })
})

describe('createSwitchProperties - State', () => {
  test('sets top-level State to 0x100 (Running)', () => {
    const ifaceDesc = { properties: {} }
    const iface = {}
    createSwitchProperties({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE }, ifaceDesc, iface)
    expect(iface.State).toBe(0x100)
    expect(ifaceDesc.properties.State).toBeDefined()
  })
})

describe('createSwitchProperties - ShowUIControl', () => {
  const showUIKey = 'SwitchableOutput/output_1/Settings/ShowUIControl'

  function run (config) {
    const ifaceDesc = { properties: {} }
    const iface = {}
    createSwitchProperties({ switch_1_type: SWITCH_TYPE_MAP.TOGGLE, ...config }, ifaceDesc, iface)
    return iface[showUIKey]
  }

  test('defaults to 1 when switch_1_show_ui_input is not set', () => {
    expect(run({})).toBe(1)
  })

  test('uses switch_1_show_ui_input value 0 (hidden)', () => {
    expect(run({ switch_1_show_ui_input: 0 })).toBe(0)
  })

  test('uses switch_1_show_ui_input value 2 (local UI only)', () => {
    expect(run({ switch_1_show_ui_input: 2 })).toBe(2)
  })

  test('uses switch_1_show_ui_input value 4 (remote UI only)', () => {
    expect(run({ switch_1_show_ui_input: 4 })).toBe(4)
  })
})

describe('expandSwitchPayload', () => {
  test('plain number for toggle uses State path', () => {
    expect(expandSwitchPayload(1, SWITCH_TYPE_MAP.TOGGLE)).toEqual({ 'SwitchableOutput/output_1/State': 1 })
  })

  test('zero (falsy) for toggle uses State path', () => {
    expect(expandSwitchPayload(0, SWITCH_TYPE_MAP.TOGGLE)).toEqual({ 'SwitchableOutput/output_1/State': 0 })
  })

  test('plain number for momentary uses State path', () => {
    expect(expandSwitchPayload(1, SWITCH_TYPE_MAP.MOMENTARY)).toEqual({ 'SwitchableOutput/output_1/State': 1 })
  })

  test('plain number for dimmable uses Dimming path', () => {
    expect(expandSwitchPayload(75, SWITCH_TYPE_MAP.DIMMABLE)).toEqual({ 'SwitchableOutput/output_1/Dimming': 75 })
  })

  test('plain number for temperature setpoint uses Dimming path', () => {
    expect(expandSwitchPayload(21.5, SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT)).toEqual({ 'SwitchableOutput/output_1/Dimming': 21.5 })
  })

  test('plain number for stepped uses Dimming path', () => {
    expect(expandSwitchPayload(2, SWITCH_TYPE_MAP.STEPPED)).toEqual({ 'SwitchableOutput/output_1/Dimming': 2 })
  })

  test('plain number for dropdown uses Dimming path', () => {
    expect(expandSwitchPayload(0, SWITCH_TYPE_MAP.DROPDOWN)).toEqual({ 'SwitchableOutput/output_1/Dimming': 0 })
  })

  test('plain number for basic slider uses Dimming path', () => {
    expect(expandSwitchPayload(50, SWITCH_TYPE_MAP.BASIC_SLIDER)).toEqual({ 'SwitchableOutput/output_1/Dimming': 50 })
  })

  test('plain number for numeric input uses Dimming path', () => {
    expect(expandSwitchPayload(42, SWITCH_TYPE_MAP.NUMERIC_INPUT)).toEqual({ 'SwitchableOutput/output_1/Dimming': 42 })
  })

  test('plain number for three-state uses State path', () => {
    expect(expandSwitchPayload(1, SWITCH_TYPE_MAP.THREE_STATE)).toEqual({ 'SwitchableOutput/output_1/State': 1 })
  })

  test('plain number for bilge pump uses State path', () => {
    expect(expandSwitchPayload(1, SWITCH_TYPE_MAP.BILGE_PUMP)).toEqual({ 'SwitchableOutput/output_1/State': 1 })
  })

  test('plain number for RGB color wheel returns null (no shortcut)', () => {
    expect(expandSwitchPayload(1, SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)).toBeNull()
  })

  test('plain number for CCT wheel returns null (no shortcut)', () => {
    expect(expandSwitchPayload(1, SWITCH_TYPE_MAP.CCT_WHEEL)).toBeNull()
  })

  test('plain number for RGB white dimmer returns null (no shortcut)', () => {
    expect(expandSwitchPayload(1, SWITCH_TYPE_MAP.RGB_WHITE_DIMMER)).toBeNull()
  })

  test('object payload is returned unchanged', () => {
    const payload = { 'SwitchableOutput/output_1/State': 1 }
    expect(expandSwitchPayload(payload, SWITCH_TYPE_MAP.TOGGLE)).toBe(payload)
  })

  test('null payload is returned as-is', () => {
    expect(expandSwitchPayload(null, SWITCH_TYPE_MAP.TOGGLE)).toBeNull()
  })
})

describe('shouldApplyPayloadToDBus', () => {
  const autoKey = 'SwitchableOutput/output_1/Auto'

  function makeIface (autoValue) {
    return { [autoKey]: autoValue }
  }

  describe('non-three-state switch types', () => {
    test('always returns true for toggle switch regardless of mode', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.TOGGLE), switch_1_passthrough_mode: 'auto_only' }
      expect(shouldApplyPayloadToDBus(config, makeIface(0))).toBe(true)
    })

    test('always returns true for momentary switch', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.MOMENTARY) }
      expect(shouldApplyPayloadToDBus(config, makeIface(0))).toBe(true)
    })
  })

  describe('three-state switch - mode: always', () => {
    test('applies when Auto=1 (auto mode)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE), switch_1_passthrough_mode: 'always' }
      expect(shouldApplyPayloadToDBus(config, makeIface(1))).toBe(true)
    })

    test('applies when Auto=0 (manual mode)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE), switch_1_passthrough_mode: 'always' }
      expect(shouldApplyPayloadToDBus(config, makeIface(0))).toBe(true)
    })
  })

  describe('three-state switch - mode: auto_only (default)', () => {
    test('applies when Auto=1', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE), switch_1_passthrough_mode: 'auto_only' }
      expect(shouldApplyPayloadToDBus(config, makeIface(1))).toBe(true)
    })

    test('blocks when Auto=0', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE), switch_1_passthrough_mode: 'auto_only' }
      expect(shouldApplyPayloadToDBus(config, makeIface(0), {})).toBe(false)
    })

    test('allows payload that sets Auto=1 even when currently in manual mode', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE), switch_1_passthrough_mode: 'auto_only' }
      const payload = { [autoKey]: 1 }
      expect(shouldApplyPayloadToDBus(config, makeIface(0), payload)).toBe(true)
    })

    test('allows payload with leading-slash key that sets Auto=1 when in manual mode', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE), switch_1_passthrough_mode: 'auto_only' }
      const payload = { ['/' + autoKey]: 1 }
      expect(shouldApplyPayloadToDBus(config, makeIface(0), payload)).toBe(true)
    })

    test('defaults to always when mode is not set (backward compat for existing nodes)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE) }
      expect(shouldApplyPayloadToDBus(config, makeIface(0))).toBe(true)
      expect(shouldApplyPayloadToDBus(config, makeIface(1))).toBe(true)
    })
  })

  describe('three-state switch - edge cases', () => {
    test('unknown mode defaults to applying (safe fallback)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE), switch_1_passthrough_mode: 'unknown_value' }
      expect(shouldApplyPayloadToDBus(config, makeIface(0))).toBe(true)
    })

    test('applies when Auto is null (state not yet set)', () => {
      const config = { switch_1_type: String(SWITCH_TYPE_MAP.THREE_STATE), switch_1_passthrough_mode: 'auto_only' }
      expect(shouldApplyPayloadToDBus(config, makeIface(null))).toBe(false)
    })
  })
})
