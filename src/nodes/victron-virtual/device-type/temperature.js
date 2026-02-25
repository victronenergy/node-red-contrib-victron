const properties = {
  Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', persist: 60 /* persist, but throttled to 60 seconds */, immediate: true },
  TemperatureType: {
    type: 'i',
    value: 2,
    min: 0,
    max: 2,
    format: (v) => ({
      0: 'Battery',
      1: 'Fridge',
      2: 'Generic',
      3: 'Room',
      4: 'Outdoor',
      5: 'WaterHeater',
      6: 'Freezer'
    }[v] || 'unknown')
  },
  Pressure: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'hPa' : '', persist: 60 },
  Humidity: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '%' : '', persist: 60 },
  BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: 300 },
  Status: { type: 'i', persist: true /* persist on every state change */ }
}

function initialize (config, ifaceDesc, iface, node) {
  iface.TemperatureType = Number(config.temperature_type ?? 2)
  if (!config.include_humidity) {
    delete ifaceDesc.properties.Humidity
    delete iface.Humidity
  }
  if (!config.include_pressure) {
    delete ifaceDesc.properties.Pressure
    delete iface.Pressure
  }
  if (!config.include_temp_battery) {
    delete ifaceDesc.properties.BatteryVoltage
    delete iface.BatteryVoltage
  } else {
    iface.BatteryVoltage = Number(config.temp_battery_voltage ?? 3.3)
  }
  if (config.default_values) {
    iface.Temperature = 25
    iface.Humidity = 50
    iface.Pressure = 1013
  }
  return `Virtual ${properties.TemperatureType.format(iface.TemperatureType).toLowerCase()} temperature sensor`
}

module.exports = { properties, initialize, label: 'Temperature sensor' }
