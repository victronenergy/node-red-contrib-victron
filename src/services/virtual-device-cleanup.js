const debug = require('debug')('victron-virtual-device-cleanup')

/**
 * Filters a list of virtual devices to identify those that are inactive
 * and should be removed from the settings.
 *
 * @param {Array<Array>} deviceEntries - An array of device entries from DBus settings,
 *   as returned by GetValue on /Settings/Devices (paths relative to that path).
 *   Each entry is `['{devicePath}/ClassAndVrmInstance', [tree, ['deviceType:instance']]]`
 *   where tree is the dbus-native parsed signature object (e.g. {type:'s'}).
 * @param {Array<string>} activeServices - A list of currently active DBus service names.
 * @returns {Array<string>} An array of `devicePath` strings for devices that should be removed.
 */
function filterInactiveVirtualDevices (deviceEntries, activeServices) {
  debug('Filtering inactive virtual devices')
  return deviceEntries
    .filter(entry => {
      const path = entry[0]
      return typeof path === 'string' &&
             path.startsWith('virtual_') &&
             path.includes('/ClassAndVrmInstance')
    })
    .map(entry => entry[0].split('/')[0]) // Extract 'virtual_{nodeId}'
    .filter((devicePath, index, self) => self.indexOf(devicePath) === index) // Unique devicePaths
    .filter(devicePath => {
      const deviceNodeId = devicePath.substring('virtual_'.length)

      // Find the corresponding deviceEntry to get the deviceType
      // Note: deviceEntries paths are relative to /Settings/Devices/
      const deviceEntry = deviceEntries.find(entry => entry[0] === `${devicePath}/ClassAndVrmInstance`)

      // dbus-native returns variants as [tree, [value]], so the actual string is at [1][1][0]
      const classAndVrmInstance = deviceEntry?.[1]?.[1]?.[0]
      if (typeof classAndVrmInstance !== 'string') {
        debug(`No ClassAndVrmInstance found for device ${devicePath}, will not remove`)
        return false // Don't remove if we can't determine the device type
      }

      const deviceType = classAndVrmInstance.split(':')[0] // e.g., "switch", "generator", etc.

      // Map ClassAndVrmInstance device types to DBus service name prefixes.
      // New devices store the D-Bus type directly (e.g. 'genset', 'dcgenset', 'motordrive').
      // Legacy entries (created before this fix) stored the UI type ('generator', 'e-drive').
      // Handle both formats for backward compatibility:
      // 'generator' can be either genset or dcgenset on DBus, so check both.
      // 'e-drive' maps to motordrive on DBus.
      let possibleServiceNames
      if (deviceType === 'generator') {
        possibleServiceNames = [
          `com.victronenergy.genset.virtual_${deviceNodeId}`,
          `com.victronenergy.dcgenset.virtual_${deviceNodeId}`
        ]
      } else if (deviceType === 'e-drive') {
        possibleServiceNames = [`com.victronenergy.motordrive.virtual_${deviceNodeId}`]
      } else {
        possibleServiceNames = [`com.victronenergy.${deviceType}.virtual_${deviceNodeId}`]
      }

      debug(`Checking if any of ${possibleServiceNames} is active for device ${devicePath}`)

      const isServiceActive = possibleServiceNames.some(name => activeServices.includes(name))

      if (isServiceActive) {
        debug(`A service for ${devicePath} is still active on DBus, will not remove.`)
        return false
      }

      debug(`No active DBus service found for device ${devicePath}, can be removed.`)
      return true
    })
}

module.exports = {
  filterInactiveVirtualDevices
}
