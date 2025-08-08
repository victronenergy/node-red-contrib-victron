/**
 * Tank device configuration for Victron Virtual devices
 */

const tankProperties = {
  'Alarms/High/Active': { type: 'd' },
  'Alarms/High/Delay': { type: 'd' },
  'Alarms/High/Enable': { type: 'd' },
  'Alarms/High/Restore': { type: 'd' },
  'Alarms/High/State': { type: 'd' },
  'Alarms/Low/Active': { type: 'd' },
  'Alarms/Low/Delay': { type: 'd' },
  'Alarms/Low/Enable': { type: 'd' },
  'Alarms/Low/Restore': { type: 'd' },
  'Alarms/Low/State': { type: 'd' },
  Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'm3' : '' },
  FluidType: {
    type: 'i',
    format: (v) => ({
      0: 'Fuel',
      1: 'Fresh water',
      2: 'Waste water',
      3: 'Live well',
      4: 'Oil',
      5: 'Black water (sewage)',
      6: 'Gasoline',
      7: 'Diesel',
      8: 'LPG',
      9: 'LNG',
      10: 'Hydraulic oil',
      11: 'Raw water'
    }[v] || 'unknown'),
    value: 0,
    persist: true
  },
  Level: { type: 'd', format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: 60 },
  RawUnit: { type: 's', persist: true },
  RawValue: { type: 'd' },
  RawValueEmpty: { type: 'd', persist: true },
  RawValueFull: { type: 'd', persist: true },
  Remaining: { type: 'd' },
  Shape: { type: 's', persist: true },
  Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 60 },
  BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  Status: { type: 'i' }
}

/**
 * Configure tank device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureTankDevice (config, iface, ifaceDesc) {
  iface.FluidType = Number(config.fluid_type ?? 1)

  if (!config.include_tank_battery) {
    delete ifaceDesc.properties.BatteryVoltage
    delete iface.BatteryVoltage
  } else {
    iface.BatteryVoltage = Number(config.tank_battery_voltage ?? 3.3)
  }
  if (!config.include_tank_temperature) {
    delete ifaceDesc.properties.Temperature
    delete iface.Temperature
  }
  if (config.tank_capacity !== '' && config.tank_capacity !== undefined) {
    const capacity = Number(config.tank_capacity)
    if (isNaN(capacity) || capacity <= 0) {
      console.error('Tank capacity must be greater than 0')
      return
    }
    iface.Capacity = capacity
  }
  if (config.default_values) {
    iface.Level = 50
    iface.Temperature = 25
  }

  // Ensure FluidType has a value, defaulting to Fuel (0) if not set
  if (iface.FluidType == null) {
    iface.FluidType = tankProperties.FluidType.value
  }

  return `Virtual ${tankProperties.FluidType.format(iface.FluidType).toLowerCase()} tank`
}

module.exports = {
  properties: tankProperties,
  configure: configureTankDevice
}
