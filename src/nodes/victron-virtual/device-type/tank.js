const properties = {
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
    persist: false
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

function initialize (config, ifaceDesc, iface, node) {
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
      node.error('Tank capacity must be greater than 0')
      return
    }
    iface.Capacity = capacity
  }
  if (config.default_values) {
    iface.Level = 50
    iface.Temperature = 25
  }
  return `Virtual ${properties.FluidType.format(iface.FluidType).toLowerCase()} tank sensor`
}

module.exports = { properties, initialize, label: 'Tank sensor' }
