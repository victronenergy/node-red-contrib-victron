/**
 * Battery device configuration for Victron Virtual devices
 */

const alarmFormat = (v) => ({
  0: 'OK',
  1: 'Warning',
  2: 'Alarm'
}[v] || 'unknown')

const batteryProperties = {
  Capacity: {
    type: 'd',
    format: (v) => {
      if (v == null) return ''
      const num = Number(v)
      return isNaN(num) ? '' : num.toFixed(1) + 'Ah'
    }
  },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
  'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
  'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  ConsumedAmphours: { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'Ah' : '', persist: 300 },
  'Info/ChargeRequest': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  Soc: { type: 'i', format: (v) => v != null ? Math.round(v) + '%' : '', min: 0, max: 100, persist: 15 },
  Soh: { type: 'i', format: (v) => v != null ? Math.round(v) + '%' : '' },
  'Alarms/CellImbalance': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/HighChargeCurrent': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/HighCurrent': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/HighTemperature': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/HighVoltage': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/InternalFailure': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/LowSoc': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/LowTemperature': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/LowVoltage': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/StateOfHealth': { type: 'i', format: alarmFormat, value: 0 },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  NrOfDistributors: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'System/MinCellVoltage': { type: 'd', format: (v) => v != null ? Number(v).toFixed(3) + 'V' : '' }
}

/**
 * Configure battery device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureBatteryDevice (config, iface, ifaceDesc) {
  // Set battery capacity from configuration - only if valid number
  if (config.battery_capacity != null &&
      config.battery_capacity !== '' &&
      !isNaN(Number(config.battery_capacity))) {
    const capacity = Number(config.battery_capacity)
    iface.Capacity = capacity
  }

  if (config.default_values) {
    let voltage = 24 // fallback

    if (config.battery_voltage_preset === '12') {
      voltage = 12
    } else if (config.battery_voltage_preset === '24') {
      voltage = 24
    } else if (config.battery_voltage_preset === '48') {
      voltage = 48
    } else if (config.battery_voltage_preset === 'custom') {
      if (config.battery_voltage_custom != null &&
          config.battery_voltage_custom !== '' &&
          !isNaN(Number(config.battery_voltage_custom))) {
        voltage = Number(config.battery_voltage_custom)
      }
      // If custom is selected but no valid value provided, use default
    }
    // For any other invalid preset, use default

    iface['Dc/0/Current'] = 0
    iface['Dc/0/Voltage'] = voltage
    iface['Dc/0/Power'] = 0
    iface['Dc/0/Temperature'] = 25
    iface.Soc = 80
    iface.Soh = 100
    iface['System/MinCellVoltage'] = 3.3
  }

  // Temperature is NOT included by default - must be explicitly enabled
  if (!config.include_battery_temperature) {
    delete ifaceDesc.properties['Dc/0/Temperature']
    delete iface['Dc/0/Temperature']
  }

  // Generate display text using the format function
  const capacityText = batteryProperties.Capacity.format(iface.Capacity)

  return `Virtual ${capacityText} battery`
}

module.exports = {
  properties: batteryProperties,
  configure: configureBatteryDevice
}
