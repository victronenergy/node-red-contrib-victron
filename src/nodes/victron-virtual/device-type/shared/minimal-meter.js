const ENERGY_PERSIST_SECONDS = 60

// Generic "minimal meter" D-Bus shape (see
// https://github.com/victronenergy/venus/wiki/dbus#grid-and-genset-and-acload-and-heatpump-meter -
// Ac/Frequency is missing there, a gap in that page). Position/PhaseSetting are valid for
// acload and heatpump only - callers opt in via `includePosition`.
const sharedProperties = {
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', persist: ENERGY_PERSIST_SECONDS },
  'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', persist: ENERGY_PERSIST_SECONDS },
  'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'Hz' : '' },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/PowerFactor': { type: 'd', format: (v) => v != null ? v.toFixed(2) : '' },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  DeviceType: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  IsGenericEnergyMeter: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

const phaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Energy/Forward', unit: 'kWh', persist: ENERGY_PERSIST_SECONDS },
  { name: 'Energy/Reverse', unit: 'kWh', persist: ENERGY_PERSIST_SECONDS },
  { name: 'Power', unit: 'W' },
  { name: 'PowerFactor', unit: '' },
  { name: 'Voltage', unit: 'V' }
]

function buildMinimalMeterProperties ({ includePosition, isGenericEnergyMeter = true }) {
  const properties = {
    ...sharedProperties,
    IsGenericEnergyMeter: { ...sharedProperties.IsGenericEnergyMeter, value: isGenericEnergyMeter ? 1 : 0 }
  }
  if (includePosition) {
    properties.Position = {
      type: 'i',
      format: (v) => ({
        0: 'AC output',
        1: 'AC input'
      }[v] || 'unknown')
    }
  }
  return properties
}

function initializeMinimalMeter (config, ifaceDesc, iface, { nrOfPhases, includePosition, position, phaseSetting }) {
  if (includePosition) {
    iface.Position = Number(position ?? 0)
  }
  iface.NrOfPhases = Number(nrOfPhases ?? 1)

  const isSinglePhase = iface.NrOfPhases === 1
  let singlePhaseNumber = 1
  if (isSinglePhase && includePosition) {
    singlePhaseNumber = Number(phaseSetting ?? 1)
    iface.PhaseSetting = singlePhaseNumber
    ifaceDesc.properties.PhaseSetting = { type: 'i', format: (v) => v != null ? 'L' + v : '' }
  }

  for (let i = 1; i <= iface.NrOfPhases; i++) {
    const phase = `L${isSinglePhase ? singlePhaseNumber : i}`
    phaseProperties.forEach(({ name, unit, persist }) => {
      const key = `Ac/${phase}/${name}`
      const propDef = {
        type: 'd',
        format: (v) => v != null ? v.toFixed(2) + unit : '',
        ...(persist && { persist })
      }
      ifaceDesc.properties[key] = propDef
      iface[key] = 0
    })
  }

  if (config.default_values) {
    iface['Ac/Power'] = 0
    iface['Ac/Energy/Forward'] = 0
    iface['Ac/Energy/Reverse'] = 0
    iface['Ac/Frequency'] = 50
    iface['Ac/PowerFactor'] = 0
  }
}

module.exports = { buildMinimalMeterProperties, initializeMinimalMeter }
