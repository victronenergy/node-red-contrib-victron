const { enableS2Support } = require('../s2-support')
const { buildMinimalMeterProperties, initializeMinimalMeter } = require('./shared/minimal-meter')
const { accumulateMeterEnergy } = require('./shared/meter-energy')

const ENERGY_PERSIST_SECONDS = 60

const enumFormat = (texts) => (v) => texts[v] || 'unknown'
const unitFormat = (unit, digits) => (v) => v != null ? v.toFixed(digits) + unit : ''

// EVSE paths from https://github.com/victronenergy/venus/wiki/dbus#evcharger (Alarms/* left out).
// Nothing is readonly: dbus-victron-virtual would then also reject writes from the node input.
const chargingControlProperties = {
  Mode: { type: 'i', format: enumFormat({ 0: 'Manual', 1: 'Auto', 2: 'Scheduled' }), persist: true },
  // Persisted, so a restart doesn't reset a Stop to 0 while the real charger is still charging.
  StartStop: { type: 'i', format: enumFormat({ 0: 'Stop', 1: 'Start' }), persist: true },
  AutoStart: { type: 'i', format: enumFormat({ 0: 'Disabled', 1: 'Enabled' }), persist: true },
  EnableDisplay: { type: 'i', format: enumFormat({ 0: 'Control disabled', 1: 'Control enabled' }), persist: true },
  Current: { type: 'd', format: unitFormat('A', 1) },
  SetCurrent: { type: 'd', format: unitFormat('A', 1), persist: true },
  MinCurrent: { type: 'd', format: unitFormat('A', 1), persist: true },
  MaxCurrent: { type: 'd', format: unitFormat('A', 1), persist: true },
  // Persisted so a restart mid-charge is not taken for a car being plugged in. Immediate, so an
  // unplug and replug in quick succession are not merged by the input debounce.
  Status: {
    type: 'i',
    persist: true,
    immediate: true,
    format: enumFormat({
      0: 'Disconnected',
      1: 'Connected',
      2: 'Charging',
      3: 'Charged',
      4: 'Waiting for sun',
      5: 'Waiting for RFID',
      6: 'Waiting for start',
      7: 'Low SOC',
      8: 'Ground test error',
      9: 'Welded contacts error',
      10: 'CP input test error (shorted)',
      11: 'Residual current detected',
      12: 'Undervoltage detected',
      13: 'Overvoltage detected',
      14: 'Overheating detected',
      20: 'Charging limit',
      21: 'Starting to charge',
      22: 'Switching to 3-phase',
      23: 'Switching to 1-phase',
      24: 'Stopping charging'
    })
  },
  // Deprecated in the dbus spec in favour of Session/Time, still read by older consumers.
  ChargingTime: { type: 'i', format: unitFormat('s', 0), persist: ENERGY_PERSIST_SECONDS },
  'Session/Time': { type: 'i', format: unitFormat('s', 0), persist: ENERGY_PERSIST_SECONDS },
  'Session/Energy': { type: 'd', format: unitFormat('kWh', 2), persist: ENERGY_PERSIST_SECONDS },
  'Session/Cost': { type: 'd', format: unitFormat('', 2) },
  'Session/SavedCost': { type: 'd', format: unitFormat('', 2) },
  'Session/UserId': { type: 's' },
  'Session/UserIdType': { type: 'i', format: enumFormat({ 0: 'Unknown', 1: 'BLE' }) },
  Model: { type: 's' }
}

const chargingControlDefaults = {
  Mode: 0,
  StartStop: 0,
  AutoStart: 1,
  EnableDisplay: 1,
  Status: 0,
  Current: 0,
  SetCurrent: 6,
  MinCurrent: 6,
  MaxCurrent: 32,
  ChargingTime: 0,
  'Session/Time': 0,
  'Session/Energy': 0
}

const SESSION_TICK_MS = 10 * 1000

const STATUS_DISCONNECTED = 0
const STATUS_CHARGING = 2
const SESSION_KEYS = ['Session/Energy', 'Session/Time', 'ChargingTime']

// Measurement-only by default (a generic energy meter). Charging control adds the EVSE paths,
// but no charging logic: the flow acts on them.
function isChargingControl (config) {
  return !!config?.evcs_charging_control
}

function isAutoSession (config) {
  return isChargingControl(config) && !!config.evcs_auto_session
}

function properties (config) {
  const chargingControl = isChargingControl(config)
  return {
    ...buildMinimalMeterProperties({ includePosition: true, isGenericEnergyMeter: !chargingControl }),
    // Position comes from the node config and isn't persisted, so it's not adjustable from the GX.
    PositionIsAdjustable: { type: 'i', format: (v) => v != null ? v : '', value: 0 },
    ...(chargingControl && chargingControlProperties)
  }
}

function initialize (config, ifaceDesc, iface, node) {
  initializeMinimalMeter(config, ifaceDesc, iface, {
    nrOfPhases: config.evcs_nrofphases,
    includePosition: true,
    position: config.evcs_position,
    phaseSetting: config.evcs_phasesetting
  })

  // The node input debounces each key on its own. The session and energy calculations combine
  // power and energy values, so those paths share a group and a message lands in one call.
  for (const [key, property] of Object.entries(ifaceDesc.properties)) {
    if (key.startsWith('Ac/') || key.startsWith('Session/') || key === 'ChargingTime') {
      property.debounceGroup = 'evcs'
    }
  }

  // Opportunity Loads only needs /S2/0/Rm, Dynamic ESS also needs charging control (/Mode Auto).
  // enable_s2support is shared by all device types, so a node switched to EV charger can carry
  // it from another type; only the saved output count shows the user chose S2 here.
  if (Number(config.outputs) > 1) {
    enableS2Support({
      config,
      ifaceDesc,
      iface,
      node,
      deviceLabel: 'EV charger'
    })
  }

  if (!isChargingControl(config)) {
    return `Virtual ${iface.NrOfPhases}-phase EV charger`
  }

  if (config.default_values) {
    Object.assign(iface, chargingControlDefaults)
  }

  return `Virtual ${iface.NrOfPhases}-phase EV charger (charging control)`
}

// Counts Session/Time over the interval since the previous call, using the status that applied
// during that interval, and resets the session when a car is plugged in. A value the flow sets
// explicitly wins.
function accumulateSession (changes, instance, now) {
  // A null Status (charger offline) says nothing about the car, so a plug-in is judged against
  // the last real status.
  if (instance.Status != null) instance._lastKnownStatus = instance.Status
  const oldStatus = instance.Status
  const lastTs = instance._lastSessionTimestamp
  instance._lastSessionTimestamp = now

  let timeCalculated = false
  const isNewSession = changes.Status != null && instance._lastKnownStatus === STATUS_DISCONNECTED && changes.Status !== STATUS_DISCONNECTED
  if (isNewSession) {
    instance._sessionSeconds = 0
    SESSION_KEYS.forEach(key => {
      if (!(key in changes)) changes[key] = 0
    })
  } else if (oldStatus === STATUS_CHARGING && lastTs != null) {
    if (!('Session/Time' in changes)) {
      // Keep fractional seconds internally, Session/Time is an integer on D-Bus.
      instance._sessionSeconds = (instance._sessionSeconds ?? instance['Session/Time'] ?? 0) + (now - lastTs) / 1000
      timeCalculated = true
      const seconds = Math.floor(instance._sessionSeconds)
      if (seconds !== instance['Session/Time']) changes['Session/Time'] = seconds
    }
  }

  if ('Session/Time' in changes) {
    // A value equal to our own rounded total is sessionTick's result coming back through
    // setValuesLocally; only a different value is a real override from the flow.
    const isOwnValue = changes['Session/Time'] === Math.floor(instance._sessionSeconds)
    if (!timeCalculated && !isOwnValue) instance._sessionSeconds = changes['Session/Time']
    if (!('ChargingTime' in changes)) changes.ChargingTime = changes['Session/Time']
  }
}

// Session/Energy is the growth of Ac/Energy/Forward since the car was plugged in, so it follows
// the meter whether the flow reports the energy or it is calculated. Runs after accumulateSession,
// which resets Session/Energy to 0 on a plug-in.
function followSessionEnergy (changes, instance, autoEnergy) {
  // A restored or default meter value is only a starting point for the node's own calculation.
  // A counter the flow reports counts from its first reading since this start.
  if ('Ac/Energy/Forward' in changes || autoEnergy) instance._meterKnown = true
  const status = changes.Status != null ? changes.Status : instance._lastKnownStatus
  if (status == null || status === STATUS_DISCONNECTED) return
  if (!instance._meterKnown) {
    instance._sessionEnergyStart = null
    return
  }

  const meter = 'Ac/Energy/Forward' in changes ? changes['Ac/Energy/Forward'] : instance['Ac/Energy/Forward']
  if (meter == null) return
  const session = 'Session/Energy' in changes ? changes['Session/Energy'] : (instance['Session/Energy'] || 0)
  // A session energy set by the flow (or reset on a plug-in), the first reading of this session or
  // a meter that went back (e.g. the real charger's counter was reset): continue from there
  if ('Session/Energy' in changes || instance._sessionEnergyStart == null || meter < instance['Ac/Energy/Forward']) {
    instance._sessionEnergyStart = meter - session
    return
  }

  const sessionEnergy = meter - instance._sessionEnergyStart
  if (sessionEnergy !== instance['Session/Energy']) changes['Session/Energy'] = sessionEnergy
}

// A single-phase charger reports on the phase it's wired to, multi-phase ones on L1 upwards.
function meterPhases (config) {
  const nrOfPhases = Number(config.evcs_nrofphases ?? 1)
  if (nrOfPhases === 1) return [Number(config.evcs_phasesetting ?? 1)]
  return Array.from({ length: nrOfPhases }, (_, i) => i + 1)
}

function onPropertiesChanged ({ changes, instance, config }) {
  const now = Date.now()
  if (config.evcs_auto_energy) {
    accumulateMeterEnergy({ changes, instance, phases: meterPhases(config), now })
  }
  if (isAutoSession(config)) {
    accumulateSession(changes, instance, now)
    followSessionEnergy(changes, instance, !!config.evcs_auto_energy)
  }
  return changes
}

// Called periodically by the node so Session/Time keeps running between power updates.
function sessionTick ({ instance, config }) {
  if (!isAutoSession(config) || instance.Status !== STATUS_CHARGING) return null
  const changes = {}
  accumulateSession(changes, instance, Date.now())
  return Object.keys(changes).length > 0 ? changes : null
}

// Returns a stop function, or null when auto session is off.
function startSessionTimer ({ node, instance, config }) {
  if (!isAutoSession(config)) return null
  const handle = setInterval(() => {
    const changes = sessionTick({ instance, config })
    if (!changes) return
    try {
      node.setValuesLocally(changes)
    } catch (err) {
      node.error(`Failed to update EV charger session: ${err.message}`)
    }
  }, SESSION_TICK_MS)
  return () => clearInterval(handle)
}

// Registers as com.victronenergy.evcharger on D-Bus - see minimal-meter.js.
function getServiceType () {
  return 'evcharger'
}

function productType () {
  return 'evcs'
}

module.exports = {
  properties,
  initialize,
  getServiceType,
  productType,
  onPropertiesChanged,
  isChargingControl,
  isAutoSession,
  sessionTick,
  startSessionTimer,
  label: 'EV charger',
  supportsS2: true
}
