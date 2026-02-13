/* eslint-env jest */

const { describe, it, expect } = require('@jest/globals')

describe('Virtual Device Removal Logic', () => {
  // Simulate the filtering logic from victron-virtual.js
  const filterDevicesToRemove = (virtualDevices, deviceEntries, activeServices) => {
    return virtualDevices.filter(devicePath => {
      // Only consider devices that follow our naming pattern: virtual_{nodeId}
      if (!devicePath.startsWith('virtual_')) {
        return false // Don't remove devices that don't follow our pattern
      }

      // Extract the node ID from the device name
      const deviceNodeId = devicePath.substring('virtual_'.length)

      // Construct the expected service name for this virtual device
      // We need to get the device type from the ClassAndVRMInstance value
      const deviceEntry = deviceEntries.find(entry => {
        const path = entry[0]
        return path === `/Settings/Devices/${devicePath}/ClassAndVrmInstance`
      })

      if (!deviceEntry || !deviceEntry[1] || !deviceEntry[1][0]) {
        return false // Don't remove if we can't determine the device type
      }

      const classAndVrmInstance = deviceEntry[1][0]
      const deviceType = classAndVrmInstance.split(':')[0] // e.g., "switch", "generator", etc.

      // Construct the expected service name
      let serviceName
      if (deviceType === 'dcgenset') {
        serviceName = `com.victronenergy.dcgenset.virtual_${deviceNodeId}`
      } else if (deviceType === 'genset') {
        serviceName = `com.victronenergy.genset.virtual_${deviceNodeId}`
      } else if (deviceType === 'motordrive') {
        serviceName = `com.victronenergy.motordrive.virtual_${deviceNodeId}`
      } else {
        serviceName = `com.victronenergy.${deviceType}.virtual_${deviceNodeId}`
      }

      // Check if this service is active on DBus
      const isServiceActive = activeServices.includes(serviceName)

      // Only remove if the service is NOT active on DBus
      return !isServiceActive
    })
  }

  it('should not remove devices whose services are still active on DBus', () => {
    const virtualDevices = ['virtual_node1', 'virtual_node2', 'virtual_node3']
    const deviceEntries = [
      ['/Settings/Devices/virtual_node1/ClassAndVrmInstance', ['switch:10']],
      ['/Settings/Devices/virtual_node2/ClassAndVrmInstance', ['generator:20']],
      ['/Settings/Devices/virtual_node3/ClassAndVrmInstance', ['switch:30']]
    ]
    const activeServices = [
      'com.victronenergy.switch.virtual_node1',
      'com.victronenergy.generator.virtual_node2'
      // Note: com.victronenergy.switch.virtual_node3 is NOT in the list
    ]

    const devicesToRemove = filterDevicesToRemove(virtualDevices, deviceEntries, activeServices)

    // Should only remove virtual_node3 because its service is not active
    expect(devicesToRemove).toEqual(['virtual_node3'])
  })

  it('should not remove devices that do not follow the virtual_ pattern', () => {
    const virtualDevices = ['virtual_node1', 'other_device', 'another_device']
    const deviceEntries = [
      ['/Settings/Devices/virtual_node1/ClassAndVrmInstance', ['switch:10']]
    ]
    const activeServices = [] // No active services

    const devicesToRemove = filterDevicesToRemove(virtualDevices, deviceEntries, activeServices)

    expect(devicesToRemove).toEqual(['virtual_node1'])
    expect(devicesToRemove).not.toContain('other_device')
    expect(devicesToRemove).not.toContain('another_device')
  })

  it('should handle different device types correctly', () => {
    const virtualDevices = ['virtual_abc123', 'virtual_def456']
    const deviceEntries = [
      ['/Settings/Devices/virtual_abc123/ClassAndVrmInstance', ['dcgenset:10']],
      ['/Settings/Devices/virtual_def456/ClassAndVrmInstance', ['motordrive:20']]
    ]
    const activeServices = [
      'com.victronenergy.dcgenset.virtual_abc123'
      // Note: com.victronenergy.motordrive.virtual_def456 is NOT active
    ]

    const devicesToRemove = filterDevicesToRemove(virtualDevices, deviceEntries, activeServices)

    // Should only remove virtual_def456 because its service is not active
    expect(devicesToRemove).toEqual(['virtual_def456'])
  })

  it('should not remove any devices if all services are active', () => {
    const virtualDevices = ['virtual_node1', 'virtual_node2']
    const deviceEntries = [
      ['/Settings/Devices/virtual_node1/ClassAndVrmInstance', ['switch:10']],
      ['/Settings/Devices/virtual_node2/ClassAndVrmInstance', ['generator:20']]
    ]
    const activeServices = [
      'com.victronenergy.switch.virtual_node1',
      'com.victronenergy.generator.virtual_node2'
    ]

    const devicesToRemove = filterDevicesToRemove(virtualDevices, deviceEntries, activeServices)

    expect(devicesToRemove).toHaveLength(0)
  })

  it('should remove all virtual devices if their services are not active', () => {
    const virtualDevices = ['virtual_node1', 'virtual_node2', 'virtual_node3']
    const deviceEntries = [
      ['/Settings/Devices/virtual_node1/ClassAndVrmInstance', ['switch:10']],
      ['/Settings/Devices/virtual_node2/ClassAndVrmInstance', ['generator:20']],
      ['/Settings/Devices/virtual_node3/ClassAndVrmInstance', ['switch:30']]
    ]
    const activeServices = [] // No active services

    const devicesToRemove = filterDevicesToRemove(virtualDevices, deviceEntries, activeServices)

    expect(devicesToRemove).toEqual(['virtual_node1', 'virtual_node2', 'virtual_node3'])
  })

  it('should handle empty device list', () => {
    const virtualDevices = []
    const deviceEntries = []
    const activeServices = ['com.victronenergy.switch.virtual_node1']

    const devicesToRemove = filterDevicesToRemove(virtualDevices, deviceEntries, activeServices)

    expect(devicesToRemove).toHaveLength(0)
  })

  it('should not remove devices from other Node-RED instances if their services are active', () => {
    // Simulate devices from different Node-RED instances
    const virtualDevices = ['virtual_node1_instance1', 'virtual_node1_instance2', 'virtual_node2']
    const deviceEntries = [
      ['/Settings/Devices/virtual_node1_instance1/ClassAndVrmInstance', ['switch:10']],
      ['/Settings/Devices/virtual_node1_instance2/ClassAndVrmInstance', ['switch:20']],
      ['/Settings/Devices/virtual_node2/ClassAndVrmInstance', ['generator:30']]
    ]
    const activeServices = [
      'com.victronenergy.switch.virtual_node1_instance1',
      'com.victronenergy.switch.virtual_node1_instance2',
      'com.victronenergy.generator.virtual_node2'
      // All services are active, including those from other instances
    ]

    const devicesToRemove = filterDevicesToRemove(virtualDevices, deviceEntries, activeServices)

    // Should not remove any devices because all services are active
    expect(devicesToRemove).toHaveLength(0)
  })

  it('should handle missing ClassAndVrmInstance data gracefully', () => {
    const virtualDevices = ['virtual_node1', 'virtual_node2']
    const deviceEntries = [
      ['/Settings/Devices/virtual_node1/ClassAndVrmInstance', ['switch:10']]
      // Note: virtual_node2 is missing from deviceEntries
    ]
    const activeServices = []

    const devicesToRemove = filterDevicesToRemove(virtualDevices, deviceEntries, activeServices)

    // Should only remove virtual_node1 (has data and service not active)
    // Should NOT remove virtual_node2 (missing data, so we don't remove it)
    expect(devicesToRemove).toEqual(['virtual_node1'])
  })
})
