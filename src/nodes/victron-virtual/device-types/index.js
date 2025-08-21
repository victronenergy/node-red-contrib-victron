/**
 * Device registry for Victron Virtual devices
 * Centralizes all device configurations
 */

const batteryDevice = require('./battery')
const gensetDevice = require('./genset')
const gpsDevice = require('./gps')
const gridDevice = require('./grid')
const meteoDevice = require('./meteo')
const motordriveDevice = require('./motordrive')
const pvinverterDevice = require('./pvinverter')
const switchDevice = require('./switch')
const tankDevice = require('./tank')
const temperatureDevice = require('./temperature')

// Device registry - maps device types to their configurations
const deviceRegistry = {
  battery: batteryDevice,
  generator: gensetDevice,
  gps: gpsDevice,
  grid: gridDevice,
  meteo: meteoDevice,
  motordrive: motordriveDevice,
  pvinverter: pvinverterDevice,
  switch: switchDevice,
  tank: tankDevice,
  temperature: temperatureDevice
}

function transformDeviceName (dev) {
  if (!dev || typeof dev !== 'string') {
    throw new Error('Invalid device name provided')
  }
  if (dev === 'generator') {
    return 'genset'
  }
  return dev
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
  transformDeviceName,
  getDeviceConfig,
  isDeviceSupported,
  getSupportedDeviceTypes
}
