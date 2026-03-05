const properties = {
  Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'Ah' : '', persist: false },
  'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '', immediate: true },
  'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '', immediate: true },
  'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', immediate: true },
  'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Info/BatteryLowVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  'Info/MaxChargeVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  'Info/MaxChargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
  'Info/MaxDischargeCurrent': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
  'Info/ChargeRequest': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  Soc: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: 15 /* persist, but throttled to 15 seconds */, immediate: true },
  Soh: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '', persist: 60 /* persist, but throttled to 60 seconds */, immediate: true },
  TimeToGo: { type: 'd', max: 864000, format: (v) => v != null ? v.toFixed(0) + 's' : '', immediate: true },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1, immediate: true },
  'Alarms/CellImbalance': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/HighCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/HighChargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/HighCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/HighDischargeCurrent': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/HighTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/HighVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/InternalFailure': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowCellVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowSoc': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/StateOfHealth': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  NrOfDistributors: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  'System/NrOfBatteries': { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  'System/BatteriesParallel': { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  'System/BatteriesSeries': { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  'System/NrOfCellsPerBattery': { type: 'i', format: (v) => v != null ? v : '', value: 16 },
  'System/MinCellVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'V' : '', immediate: true },
  'System/MinVoltageCellId': { type: 'i', format: (v) => v != null ? v : '' },
  'System/MaxCellVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(3) + 'V' : '', immediate: true },
  'System/MaxVoltageCellId': { type: 'i', format: (v) => v != null ? v : '' },
  'System/MinCellTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'System/MinTemperatureCellId': { type: 'i', format: (v) => v != null ? v : '' },
  'System/MaxCellTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'System/MaxTemperatureCellId': { type: 'i', format: (v) => v != null ? v : '' }
}

const BATTERY_DEFAULT_VOLTAGES = ['12', '24', '48']

function initialize (config, ifaceDesc, iface, node) {
  if (config.battery_capacity != null && !isNaN(Number(config.battery_capacity))) {
    iface.Capacity = Number(config.battery_capacity)
  }
  if (config.default_values) {
    let voltage = 24
    if (BATTERY_DEFAULT_VOLTAGES.includes(config.battery_voltage_preset)) {
      voltage = Number(config.battery_voltage_preset)
    } else if (config.battery_voltage_preset === 'custom') {
      if (config.battery_voltage_custom != null &&
        config.battery_voltage_custom !== '' &&
        !isNaN(Number(config.battery_voltage_custom))) {
        voltage = Number(config.battery_voltage_custom)
      }
    }
    iface['Dc/0/Current'] = 0
    iface['Dc/0/Voltage'] = voltage
    iface['Dc/0/Power'] = 0
    iface['Dc/0/Temperature'] = 25
    iface.Soc = 80
    iface.Soh = 100
    iface['System/MinCellVoltage'] = 3.3
  }
  if (!config.include_battery_temperature) {
    delete ifaceDesc.properties['Dc/0/Temperature']
    delete iface['Dc/0/Temperature']
  }

  return `Virtual ${properties.Capacity.format(iface.Capacity)} battery`
}

module.exports = { properties, initialize, label: 'Battery' }
