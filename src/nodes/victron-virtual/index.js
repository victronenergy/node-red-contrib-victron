/**
 * Index file for Victron Virtual nodes modules
 * Re-exports all components for simpler imports
 */

// Core modules
const utils = require('./utils')
const persistence = require('./persistence')
const deviceRegistry = require('./device-registry')

// Device types
const battery = require('./device-types/battery')
const gps = require('./device-types/gps')
const grid = require('./device-types/grid')
const meteo = require('./device-types/meteo')
const motordrive = require('./device-types/motordrive')
const pvinverter = require('./device-types/pvinverter')
const switchDevice = require('./device-types/switch')
const tank = require('./device-types/tank')
const temperature = require('./device-types/temperature')

// Export all modules
module.exports = {
  // Core modules
  utils,
  persistence,
  deviceRegistry,
  
  // Device types
  deviceTypes: {
    battery,
    gps,
    grid,
    meteo,
    motordrive,
    pvinverter,
    switch: switchDevice, // Using 'switchDevice' since 'switch' is a reserved word
    tank,
    temperature
  }
}
