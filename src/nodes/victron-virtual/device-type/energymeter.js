const debug = require('debug')('victron-virtual')

const ENERGY_PERSIST_SECONDS = 60

const ROLE_TO_SERVICE_TYPE = {
  gridmeter: 'grid',
  inverter: 'pvinverter',
  generator: 'genset',
  acload: 'acload',
  evcharger: 'evcharger',
  heatpump: 'heatpump'
}

// Position (0=AC output, 1=AC input) and, for single-phase configs, PhaseSetting (which physical
// phase it's wired to) are only meaningfully configurable for these roles.
// - gridmeter/generator (grid/genset) stay fixed at 0 per the Venus OS dbus spec, "1=AC input" is
//   only valid for acload.
// - inverter (pvinverter) is intentionally excluded: buildProperties()'s "default" case below still
//   gives it a Position property, but with this module's generic 2-value output/input format, not
//   pvinverter's real 3-value enum (0=AC input 1, 1=AC output, 2=AC input 2, see the dedicated
//   pvinverter device type). That mismatch predates this change and is left as-is for now.
const POSITION_CONFIGURABLE_ROLES = ['acload', 'evcharger', 'heatpump']

const sharedProperties = {
  'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', persist: ENERGY_PERSIST_SECONDS },
  'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', persist: ENERGY_PERSIST_SECONDS },
  'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
  'Ac/PowerFactor': { type: 'd', format: (v) => v != null ? v.toFixed(2) : '' },
  Connected: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  DeviceType: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  ErrorCode: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
  IsGenericEnergyMeter: { type: 'i', format: (v) => v != null ? v : '', value: 1 },
  NrOfPhases: { type: 'i', format: (v) => v != null ? v : '', value: 1 }
}

function getServiceType (config) {
  return ROLE_TO_SERVICE_TYPE[config.energymeter_role] || 'grid'
}

function buildProperties (config) {
  debug('Building properties for energy meter with config: %o', config)

  // make copy of sharedProperties to avoid modifying the original object
  const properties = { ...sharedProperties }

  switch (config.energymeter_role) {
    case 'gridmeter':
      break
    default:
      properties.Position = { type: 'i', format: (v) => v === 0 ? 'output' : 'input', value: 0 }
      properties.PositionIsAdjustable = { type: 'i', format: (v) => v != null ? v : '', value: 0 }
  }

  return properties
}

const phaseProperties = [
  { name: 'Current', unit: 'A' },
  { name: 'Energy/Forward', unit: 'kWh', persist: ENERGY_PERSIST_SECONDS },
  { name: 'Energy/Reverse', unit: 'kWh', persist: ENERGY_PERSIST_SECONDS },
  { name: 'Power', unit: 'W' },
  { name: 'PowerFactor', unit: '' },
  { name: 'Voltage', unit: 'V' }
]

function initialize (config, ifaceDesc, iface, node) {
  const isPositionConfigurableRole = POSITION_CONFIGURABLE_ROLES.includes(config.energymeter_role)
  if (isPositionConfigurableRole) {
    iface.Position = Number(config.energymeter_position ?? 0)
  }
  iface.NrOfPhases = Number(config.energymeter_nrofphases ?? 1)

  const isSinglePhase = iface.NrOfPhases === 1
  let singlePhaseNumber = 1
  if (isSinglePhase && isPositionConfigurableRole) {
    singlePhaseNumber = Number(config.energymeter_phasesetting ?? 1)
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
  }
  return `Virtual ${iface.NrOfPhases}-phase energy meter`
}

module.exports = {
  properties: buildProperties,
  getServiceType,
  initialize,
  label: 'Energy meter',
  productType: 'energymeter',
  // we export sharedProperties for unit testing
  __sharedProperties: sharedProperties
}
