const SWITCH_TYPE_MAP = {
  MOMENTARY: 0,
  TOGGLE: 1,
  DIMMABLE: 2,
  TEMPERATURE_SETPOINT: 3,
  STEPPED: 4,
  DROPDOWN: 6,
  BASIC_SLIDER: 7,
  NUMERIC_INPUT: 8,
  THREE_STATE: 9,
  BILGE_PUMP: 10
}

const SWITCH_OUTPUT_CONFIG = {
  [SWITCH_TYPE_MAP.MOMENTARY]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.TOGGLE]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.DIMMABLE]: 3, // passthrough + state + dimming value
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: 2, // passthrough + temperature value
  [SWITCH_TYPE_MAP.STEPPED]: 3, // passthrough + state + stepped value
  [SWITCH_TYPE_MAP.DROPDOWN]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: 3, // passthrough + state + slider value
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: 3, // passthrough + state + numeric value
  [SWITCH_TYPE_MAP.THREE_STATE]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.BILGE_PUMP]: 2 // passthrough + state
}

// Will default to 'State' if not defined here
const SWITCH_SECOND_OUTPUT_LABEL = {
  [SWITCH_TYPE_MAP.DROPDOWN]: 'Selected',
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: 'Temperature'
}

const SWITCH_THIRD_OUTPUT_LABEL = {
  [SWITCH_TYPE_MAP.DIMMABLE]: 'Dimming',
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: 'Temperature',
  [SWITCH_TYPE_MAP.STEPPED]: 'Value',
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: 'Value',
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: 'Value'
}

module.exports = {
  SWITCH_TYPE_MAP,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL
}
