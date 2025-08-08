/**
 * Device registry for Victron Virtual devices
 * Centralizes all device configurations
 */

const batteryDevice = require('./battery')
const gpsDevice = require('./gps')
const meteoDevice = require('./meteo')
const temperatureDevice = require('./temperature')

// Device registry - maps device types to their configurations
const deviceRegistry = {
  battery: batteryDevice,
  gps: gpsDevice,
  meteo: meteoDevice,
  temperature: temperatureDevice
  // Add other devices as they're extracted:
  // generator: generatorDevice,
  // grid: gridDevice,
  // etc.
}

/**
 * Get device configuration by type
 * @param {string} deviceType - Device type (e.g., 'battery', 'meteo')
 * @returns {Object|null} Device configuration or null if not found
 */
function getDeviceConfig (deviceType) {
  return deviceRegistry[deviceType] || null
}

/**
 * Check if a device type is supported by the new modular system
 * @param {string} deviceType - Device type to check
 * @returns {boolean} True if device is supported
 */
function isDeviceSupported (deviceType) {
  return deviceType in deviceRegistry
}

/**
 * Get all supported device types
 * @returns {Array<string>} Array of supported device type names
 */
function getSupportedDeviceTypes () {
  return Object.keys(deviceRegistry)
}

module.exports = {
  deviceRegistry,
  getDeviceConfig,
  isDeviceSupported,
  getSupportedDeviceTypes
}
