/**
 * Battery device configuration for Victron Virtual devices
 */

const batteryProperties = {
  Capacity: { 
    type: 'd', 
    format: (v) => {
      if (v == null) return ''
      const num = Number(v)
      return isNaN(num) ? '' : num.toFixed(0) + 'Ah'
    }
  },
  'Dc/0/Current': { type: 'd', format: (v) => v != null ? Number(v).toFixed(2) + 'A' : '' },
  'Dc/0/Power': { type: 'd', format: (v) => v != null ? Number(v).toFixed(2) + 'W' : '' },
  'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? Number(v).toFixed(2) + 'V' : '' },
  'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? Number(v).toFixed(1) + 'C' : '' },
  'Info/BatteryLowVoltage': { type: 'd', format: (v) => v != null ? Number(v).toFixed(2) + 'V' : '' },
  'Info/MaxChargeVoltage': { type: 'd', format: (v) => v != null ? Number(v).toFixed(2) + 'V' : '' },
  'Info/MaxChargeCurrent': { type: 'd', format: (v) => v != null ? Number(v).toFixed(2) + 'A' : '' },
  'Info/MaxDischargeCurrent': { type: 'd', format: (v) => v != null ? Number(v).toFixed(2) + 'A' : '' },
  'Info/ChargeRequest': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  Soc: { 
    type: 'd', 
    min: 0, 
    max: 100, 
    format: (v) => v != null ? Number(v).toFixed(0) + '%' : '', 
    persist: 15 
  },
  Soh: { 
    type: 'd', 
    min: 0, 
    max: 100, 
    format: (v) => v != null ? Number(v).toFixed(0) + '%' : '', 
    persist: 60 
  },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  'Alarms/CellImbalance': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighChargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighDischargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/HighVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/InternalFailure': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/LowCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/LowSoc': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/LowTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/LowVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'Alarms/StateOfHealth': { type: 'i', format: (v) => v != null ? v : '', value: 0 },
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
  // Set battery capacity from configuration - always use config value
  if (config.battery_capacity != null && !isNaN(Number(config.battery_capacity))) {
    const capacity = Number(config.battery_capacity)
    iface.Capacity = capacity
  }

  if (config.default_values) {
    iface['Dc/0/Current'] = 0
    iface['Dc/0/Voltage'] = 24
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