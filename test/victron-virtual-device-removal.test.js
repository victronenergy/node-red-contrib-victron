/* eslint-env jest */

const { describe, it, expect } = require('@jest/globals')
const { filterInactiveVirtualDevices } = require('../src/services/virtual-device-cleanup')

// deviceEntries reflect the actual dbus-native-victron wire format returned by GetValue on
// /Settings/Devices. Paths are relative to that path, and each value is a dbus-native variant:
// [parsedSignatureTree, [value]]
// e.g. ['virtual_abc/ClassAndVrmInstance', [{type:'s'}, ['switch:10']]]

describe('Virtual Device Removal Logic', () => {
  it('should not remove devices whose services are still active on DBus', () => {
    const deviceEntries = [
      ['virtual_node1/ClassAndVrmInstance', [{ type: 's' }, ['switch:10']]],
      ['virtual_node2/ClassAndVrmInstance', [{ type: 's' }, ['generator:20']]],
      ['virtual_node3/ClassAndVrmInstance', [{ type: 's' }, ['switch:30']]]
    ]
    const activeServices = [
      'com.victronenergy.switch.virtual_node1',
      'com.victronenergy.genset.virtual_node2'
      // Note: com.victronenergy.switch.virtual_node3 is NOT in the list
    ]

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    // Should only remove virtual_node3 because its service is not active
    expect(devicesToRemove).toEqual(['virtual_node3'])
  })

  it('should not remove devices that do not follow the virtual_ pattern', () => {
    // Non-virtual entries would appear as e.g. 'other_device/ClassAndVrmInstance'
    const deviceEntries = [
      ['virtual_node1/ClassAndVrmInstance', [{ type: 's' }, ['switch:10']]],
      ['other_device/ClassAndVrmInstance', [{ type: 's' }, ['switch:20']]]
    ]
    const activeServices = [] // No active services

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    expect(devicesToRemove).toEqual(['virtual_node1'])
    expect(devicesToRemove).not.toContain('other_device')
  })

  it('should handle different device types correctly', () => {
    const deviceEntries = [
      ['virtual_abc123/ClassAndVrmInstance', [{ type: 's' }, ['generator:10']]], // AC genset
      ['virtual_def456/ClassAndVrmInstance', [{ type: 's' }, ['generator:20']]], // DC genset (dcgenset on DBus)
      ['virtual_ghi789/ClassAndVrmInstance', [{ type: 's' }, ['e-drive:30']]],
      ['virtual_jkl012/ClassAndVrmInstance', [{ type: 's' }, ['e-drive:40']]], // inactive motordrive
      ['virtual_mno345/ClassAndVrmInstance', [{ type: 's' }, ['genset:50']]], // AC genset
      ['virtual_pqr678/ClassAndVrmInstance', [{ type: 's' }, ['dcgenset:60']]], // DC genset (dcgenset on DBus)
      ['virtual_stu901/ClassAndVrmInstance', [{ type: 's' }, ['motordrive:70']]],
      ['virtual_vwx234/ClassAndVrmInstance', [{ type: 's' }, ['motordrive:80']]] // inactive motordrive
    ]
    const activeServices = [
      'com.victronenergy.genset.virtual_abc123',
      'com.victronenergy.dcgenset.virtual_def456', // generator maps to both genset and dcgenset
      'com.victronenergy.motordrive.virtual_ghi789', // e-drive maps to motordrive
      'com.victronenergy.genset.virtual_mno345',
      'com.victronenergy.dcgenset.virtual_pqr678',
      'com.victronenergy.motordrive.virtual_stu901'
      // Note: com.victronenergy.motordrive.virtual_jkl012 and com.victronenergy.motordrive.virtual_vwx234 are NOT active
    ]

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    expect(devicesToRemove).toEqual(['virtual_jkl012', 'virtual_vwx234'])
  })

  it('should not remove any devices if all services are active', () => {
    const deviceEntries = [
      ['virtual_node1/ClassAndVrmInstance', [{ type: 's' }, ['switch:10']]],
      ['virtual_node2/ClassAndVrmInstance', [{ type: 's' }, ['generator:20']]]
    ]
    const activeServices = [
      'com.victronenergy.switch.virtual_node1',
      'com.victronenergy.genset.virtual_node2'
    ]

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    expect(devicesToRemove).toHaveLength(0)
  })

  it('should remove all virtual devices if their services are not active', () => {
    const deviceEntries = [
      ['virtual_node1/ClassAndVrmInstance', [{ type: 's' }, ['switch:10']]],
      ['virtual_node2/ClassAndVrmInstance', [{ type: 's' }, ['generator:20']]],
      ['virtual_node3/ClassAndVrmInstance', [{ type: 's' }, ['switch:30']]]
    ]
    const activeServices = [] // No active services

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    expect(devicesToRemove).toEqual(['virtual_node1', 'virtual_node2', 'virtual_node3'])
  })

  it('should handle empty device list', () => {
    const deviceEntries = []
    const activeServices = ['com.victronenergy.switch.virtual_node1']

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    expect(devicesToRemove).toHaveLength(0)
  })

  it('should not remove devices from other Node-RED instances if their services are active', () => {
    // Simulate devices from different Node-RED instances
    const deviceEntries = [
      ['virtual_node1_instance1/ClassAndVrmInstance', [{ type: 's' }, ['switch:10']]],
      ['virtual_node1_instance2/ClassAndVrmInstance', [{ type: 's' }, ['switch:20']]],
      ['virtual_node2/ClassAndVrmInstance', [{ type: 's' }, ['generator:30']]]
    ]
    const activeServices = [
      'com.victronenergy.switch.virtual_node1_instance1',
      'com.victronenergy.switch.virtual_node1_instance2',
      'com.victronenergy.genset.virtual_node2'
      // All services are active, including those from other instances
    ]

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    // Should not remove any devices because all services are active
    expect(devicesToRemove).toHaveLength(0)
  })

  it('should not remove devices with missing or non-string ClassAndVrmInstance data', () => {
    // Entry exists in settings but its value array is empty (no actual value)
    const deviceEntries = [
      ['virtual_node1/ClassAndVrmInstance', [{ type: 's' }, ['switch:10']]],
      ['virtual_node2/ClassAndVrmInstance', [{ type: 's' }, []]] // empty value array
    ]
    const activeServices = []

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    // Should only remove virtual_node1 (has valid data, service not active)
    // Should NOT remove virtual_node2 (missing value)
    expect(devicesToRemove).toEqual(['virtual_node1'])
  })

  it('should also handle non-virtual entries mixed in with numeric values', () => {
    // Real DBus data mixes many entry types; numeric-valued entries should be ignored
    const deviceEntries = [
      ['virtual_node1/ClassAndVrmInstance', [{ type: 's' }, ['switch:10']]],
      ['adc_builtin_tank_0/Alarms/High/Active', [{ type: 'u' }, [90]]],
      ['adc_builtin_tank_0/ClassAndVrmInstance', [{ type: 's' }, ['tank:20']]]
    ]
    const activeServices = []

    const devicesToRemove = filterInactiveVirtualDevices(deviceEntries, activeServices)

    // Only virtual_node1 matches the virtual_ filter; adc entries are ignored
    expect(devicesToRemove).toEqual(['virtual_node1'])
  })
})
