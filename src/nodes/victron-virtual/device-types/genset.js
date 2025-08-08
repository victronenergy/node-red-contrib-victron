/**
 * Generator device configuration for Victron Virtual devices
 * Supports both AC generators (genset) and DC generators (dcgenset)
 */

const alarmFormat = (v) => ({
  0: 'OK',
  1: 'Warning', 
  2: 'Alarm'
}[v] || 'unknown')

const commonGeneratorProperties = {
  AutoStart: { type: 'i', format: (v) => v != null ? v : '', value: 1, persist: true },
  Start: { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: true },
  RemoteStartModeEnabled: { type: 'i', format: (v) => v != null ? v : '', value: 1, persist: true },
  EnableRemoteStartMode: { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: true },
  'Engine/CoolantTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
  'Engine/ExhaustTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
  'Engine/OilTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
  'Engine/OilPressure': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'bar' : '' },
  'Engine/WindingTemperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
  'Engine/Starts': { type: 'i', format: (v) => v != null ? v : '', value: 0, persist: 60 },
  'Engine/Load': { type: 'd', format: (v) => v != null ? v.toFixed(1) + '%' : '' },
  'Engine/Speed': { type: 'i', format: (v) => v != null ? v + 'RPM' : '' },
  'Engine/OperatingHours': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'h' : '', persist: 300 },
  'Alarms/HighTemperature': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/LowOilPressure': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/LowCoolantLevel': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/LowOilLevel': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/LowFuelLevel': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/LowStarterVoltage': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/HighStarterVoltage': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/EmergencyStop': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/ServicesNeeded': { type: 'i', format: alarmFormat, value: 0 },
  'Alarms/GenericAlarm': { type: 'i', format: alarmFormat, value: 0 },
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
    value: 0
  },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  StarterVoltage: { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '', persist: true },
  FirmwareVersion: { type: 's', format: (v) => v != null ? v : '', persist: true },
  Model: { type: 's', format: (v) => v != null ? v : '', persist: true },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

const gensetProperties = {
  ...commonGeneratorProperties,
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
  'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'Hz' : '' },
  NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

const dcgensetProperties = {
  ...commonGeneratorProperties,
  'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
  'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
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

function addAcPhaseProperties (ifaceDesc, iface, nrOfPhases) {
  const properties = [
    { name: 'Current', unit: 'A' },
    { name: 'Power', unit: 'W' },
    { name: 'Voltage', unit: 'V' }
  ]

  for (let i = 1; i <= nrOfPhases; i++) {
    const phase = `L${i}`
    properties.forEach(({ name, unit }) => {
      const key = `Ac/${phase}/${name}`
      ifaceDesc.properties[key] = {
        type: 'd',
        format: (v) => v != null ? v.toFixed(2) + unit : ''
      }
      iface[key] = 0
    })
  }
}

function removeOptionalProperties (config, ifaceDesc, iface, generatorType) {
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
}

function setDefaultValues (config, iface, generatorType) {
  if (!config.default_values) return

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

/**
 * Configure generator device with user settings
 * @param {Object} config - Node configuration
 * @param {Object} iface - Device interface object
 * @param {Object} ifaceDesc - Interface description object
 * @returns {string} Display text for the device
 */
function configureGeneratorDevice (config, iface, ifaceDesc) {
  const generatorType = config.generator_type === 'dc' ? 'dcgenset' : 'genset'
  const nrOfPhases = Number(config.generator_nrofphases ?? 1)

  if (generatorType === 'genset') {
    addAcPhaseProperties(ifaceDesc, iface, nrOfPhases)
    iface.NrOfPhases = nrOfPhases
  }

  removeOptionalProperties(config, ifaceDesc, iface, generatorType)
  setDefaultValues(config, iface, generatorType)

  const generatorLabel = generatorType === 'dcgenset' ? 'DC' : `${nrOfPhases}-phase AC`
  return `Virtual ${generatorLabel} generator`
}

module.exports = {
  properties: {
    genset: gensetProperties,
    dcgenset: dcgensetProperties
  },
  configure: configureGeneratorDevice
}
