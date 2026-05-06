// test/victron-virtual-switch-label.test.js
/* eslint-env jest */

const {
  getVirtualNodeLabel,
  SWITCH_TYPE_CONFIGS,
  INDICATOR_TYPE_LABELS
} = require('./fixtures/victron-virtual-functions.cjs')

describe('getVirtualNodeLabel', () => {
  test('returns name when set, ignoring all other fields', () => {
    expect(getVirtualNodeLabel({
      name: 'My Label',
      customname: 'Custom',
      group: 'Group',
      typeName: 'Toggle',
      fallback: 'Virtual Switch'
    })).toBe('My Label')
  })

  test('shows customname, group and typeName when name is empty', () => {
    expect(getVirtualNodeLabel({
      name: '',
      customname: 'Fan',
      group: 'Ventilation',
      typeName: 'Toggle',
      fallback: 'Virtual Switch'
    })).toBe('Fan (Ventilation) [Toggle]')
  })

  test('omits group brackets when group is empty', () => {
    expect(getVirtualNodeLabel({
      name: '',
      customname: 'Fan',
      group: '',
      typeName: 'Toggle',
      fallback: 'Virtual Switch'
    })).toBe('Fan [Toggle]')
  })

  test('omits type brackets when typeName is empty', () => {
    expect(getVirtualNodeLabel({
      name: '',
      customname: 'My Indicator',
      group: 'Sensors'
    })).toBe('My Indicator (Sensors)')
  })

  test('uses fallback when customname is empty', () => {
    expect(getVirtualNodeLabel({
      name: '',
      customname: '',
      group: '',
      typeName: 'Toggle',
      fallback: 'Virtual Switch'
    })).toBe('Virtual Switch [Toggle]')
  })

  test('defaults fallback to "Virtual" when not provided', () => {
    expect(getVirtualNodeLabel({ name: '', customname: '', group: '' })).toBe('Virtual')
  })
})

describe('virtual switch label via SWITCH_TYPE_CONFIGS', () => {
  function switchLabel (node) {
    const cfg = SWITCH_TYPE_CONFIGS[parseInt(node.switch_1_type, 10)]
    return getVirtualNodeLabel({
      name: node.name,
      customname: node.switch_1_customname,
      group: node.switch_1_group,
      typeName: cfg ? cfg.label : 'Switch',
      fallback: 'Virtual Switch'
    })
  }

  test('shows customname, group and type for a toggle switch', () => {
    expect(switchLabel({ name: '', switch_1_customname: 'Fan', switch_1_group: 'Ventilation', switch_1_type: 1 }))
      .toBe('Fan (Ventilation) [Toggle]')
  })

  test('shows correct type for all switch types', () => {
    const cases = [
      [0, 'Momentary'],
      [1, 'Toggle'],
      [2, 'Dimmable'],
      [3, 'Temperature setpoint'],
      [4, 'Stepped switch'],
      [6, 'Dropdown'],
      [7, 'Basic slider'],
      [8, 'Numeric input'],
      [9, 'Three-state switch'],
      [10, 'Bilge pump control']
    ]
    cases.forEach(([type, expectedTypeName]) => {
      expect(switchLabel({ name: '', switch_1_customname: 'S', switch_1_group: '', switch_1_type: type }))
        .toBe(`S [${expectedTypeName}]`)
    })
  })
})

describe('virtual indicator label via INDICATOR_TYPE_LABELS', () => {
  function indicatorLabel (node) {
    return getVirtualNodeLabel({
      name: node.name,
      customname: node.customname,
      group: node.group,
      typeName: INDICATOR_TYPE_LABELS[node.indicator_type],
      fallback: 'Virtual Indicator'
    })
  }

  test('shows customname, group and indicator type', () => {
    expect(indicatorLabel({ name: '', customname: 'Solar', group: 'Energy', indicator_type: 1 }))
      .toBe('Solar (Energy) [Value]')
  })

  test('shows correct type for all indicator types', () => {
    const cases = [
      [0, 'Discrete'],
      [1, 'Value'],
      [2, 'Value with range'],
      [3, 'Temperature']
    ]
    cases.forEach(([type, expectedTypeName]) => {
      expect(indicatorLabel({ name: '', customname: 'I', group: '', indicator_type: type }))
        .toBe(`I [${expectedTypeName}]`)
    })
  })
})
