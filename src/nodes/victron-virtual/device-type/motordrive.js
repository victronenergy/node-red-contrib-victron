const properties = {
  'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
  'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
  'Controller/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
  'Coolant/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
  'Motor/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
  'Motor/RPM': { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'RPM' : '' },
  'Motor/Direction': {
    type: 'i',
    format: (v) => ({
      0: 'Neutral',
      1: 'Reverse',
      2: 'Forward'
    }[v] || 'unknown'),
    value: 0,
    persist: true
  },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

function initialize (config, ifaceDesc, iface, node) {
  if (!config.include_motor_temp) {
    delete ifaceDesc.properties['Motor/Temperature']
    delete iface['Motor/Temperature']
  }
  if (!config.include_controller_temp) {
    delete ifaceDesc.properties['Controller/Temperature']
    delete iface['Controller/Temperature']
  }
  if (!config.include_coolant_temp) {
    delete ifaceDesc.properties['Coolant/Temperature']
    delete iface['Coolant/Temperature']
  }
  if (!config.include_motor_rpm) {
    delete ifaceDesc.properties['Motor/RPM']
    delete iface['Motor/RPM']
  }
  if (!config.include_motor_direction) {
    delete ifaceDesc.properties['Motor/Direction']
    delete iface['Motor/Direction']
  }

  if (config.default_values) {
    iface['Dc/0/Current'] = 0
    iface['Dc/0/Voltage'] = 48
    iface['Dc/0/Power'] = 0

    if (config.include_motor_temp) {
      iface['Motor/Temperature'] = 30
    }
    if (config.include_controller_temp) {
      iface['Controller/Temperature'] = 35
    }
    if (config.include_coolant_temp) {
      iface['Coolant/Temperature'] = 40
    }
    if (config.include_motor_rpm) {
      iface['Motor/RPM'] = 0
    }
    if (config.include_motor_direction) {
      iface['Motor/Direction'] = 0
    }
  }

  let text = 'Virtual E-drive'
  if (config.include_motor_rpm || config.include_motor_direction) {
    text += ' with'
    if (config.include_motor_rpm) text += ' RPM'
    if (config.include_motor_rpm && config.include_motor_direction) text += ' and'
    if (config.include_motor_direction) text += ' direction'
  }
  return text
}

module.exports = { properties, initialize, label: 'E-drive' }
