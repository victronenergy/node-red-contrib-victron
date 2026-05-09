const commonGeneratorProperties = {
  AutoStart: { type: 'i', format: (v) => v != null ? v : '', value: 1, persist: true },
  Start: { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: true, immediate: true },
  RemoteStartModeEnabled: { type: 'i', format: (v) => v != null ? v : '', value: 1, persist: true },
  EnableRemoteStartMode: { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: true, immediate: true },
  'Engine/CoolantTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Engine/ExhaustTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Engine/OilTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Engine/OilPressure': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'bar' : '', immediate: true },
  'Engine/WindingTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '', immediate: true },
  'Engine/Starts': { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: 60, immediate: true },
  'Engine/Load': { type: 'd', format: (v) => v != null ? v.toFixed(1) + '%' : '', immediate: true },
  'Engine/Speed': { type: 'i', format: (v) => v != null ? v + 'RPM' : '', immediate: true },
  'Engine/OperatingHours': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'h' : '', persist: 300, immediate: true },
  'Alarms/HighTemperature': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowOilPressure': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowCoolantLevel': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowOilLevel': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowFuelLevel': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/LowStarterVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/HighStarterVoltage': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/EmergencyStop': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/ServicesNeeded': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  'Alarms/GenericAlarm': { type: 'i', format: (v) => v != null ? v : '', value: 0, immediate: true },
  StatusCode: {
    type: 'i',
    format: (v) => ({
      0: 'Standby',
      1: 'Startup 1',
      2: 'Startup 2',
      3: 'Startup 3',
      4: 'Startup 4',
      5: 'Startup 5',
      6: 'Startup 6',
      7: 'Startup 7',
      8: 'Running',
      9: 'Cooldown',
      10: 'Stopping',
      11: 'Error'
    }[v] || 'unknown'),
    value: 0,
    immediate: true
  },
  'Error/0/Id': { type: 's', format: (v) => v != null ? v : '', value: '', immediate: true },
  StarterVoltage: { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: true, immediate: true },
  FirmwareVersion: { type: 's', format: (v) => v != null ? v : '', persist: true },
  Model: { type: 's', format: (v) => v != null ? v : '', persist: true },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1, immediate: true }
}

const properties = {
  genset: {
    ...commonGeneratorProperties,
    'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'Hz' : '' },
    NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
  },
  dcgenset: {
    ...commonGeneratorProperties,
    'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'History/EnergyOut': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    State: {
      type: 'i',
      format: (v) => ({
        0: 'Stopped',
        1: 'Running'
      }[v] || 'unknown'),
      value: 0
    }
  }
}

const acPhaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Power', unit: 'W' },
  { name: 'Voltage', unit: 'V' }
]

function initialize (config, ifaceDesc, iface, node) {
  const generatorType = config.generator_type === 'dc' ? 'dcgenset' : 'genset'
  const nrOfPhases = Number(config.generator_nrofphases ?? 1)

  if (generatorType === 'genset') {
    for (let i = 1; i <= nrOfPhases; i++) {
      const phase = `L${i}`
      acPhaseProperties.forEach(({ name, unit }) => {
        const key = `Ac/${phase}/${name}`
        ifaceDesc.properties[key] = {
          type: 'd',
          format: (v) => v != null ? v.toFixed(2) + unit : ''
        }
        iface[key] = 0
      })
    }
    iface.NrOfPhases = nrOfPhases
  }

  if (!config.include_engine_hours) {
    delete ifaceDesc.properties['Engine/OperatingHours']
    delete iface['Engine/OperatingHours']
  }
  if (!config.include_starter_voltage) {
    delete ifaceDesc.properties.StarterVoltage
    delete iface.StarterVoltage
    delete ifaceDesc.properties['Alarms/LowStarterVoltage']
    delete iface['Alarms/LowStarterVoltage']
    delete ifaceDesc.properties['Alarms/HighStarterVoltage']
    delete iface['Alarms/HighStarterVoltage']
  }
  if (generatorType === 'dcgenset' && !config.include_history_energy) {
    delete ifaceDesc.properties['History/EnergyOut']
    delete iface['History/EnergyOut']
  }

  if (config.default_values) {
    iface['Engine/Load'] = 0
    iface['Engine/Speed'] = 0
    iface.StatusCode = 0
    iface.State = 0

    if (generatorType === 'dcgenset') {
      iface['Dc/0/Current'] = 0
      iface['Dc/0/Voltage'] = 48
      iface['Dc/0/Power'] = 0
      iface['Dc/0/Temperature'] = 25
      if (config.include_history_energy) {
        iface['History/EnergyOut'] = 0
      }
    } else {
      iface['Ac/Power'] = 0
      iface['Ac/Energy/Forward'] = 0
    }

    if (config.include_engine_hours) {
      iface['Engine/OperatingHours'] = 0
    }
    if (config.include_starter_voltage) {
      iface.StarterVoltage = 12
    }
  }

  return `Virtual ${generatorType === 'dcgenset' ? 'DC' : `${nrOfPhases}-phase AC`} generator`
}

module.exports = { properties, initialize, label: 'Generator' }
