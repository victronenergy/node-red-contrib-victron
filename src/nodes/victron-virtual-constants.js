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
  BILGE_PUMP: 10,
  RGB_COLOR_WHEEL: 11,
  CCT_WHEEL: 12,
  RGB_WHITE_DIMMER: 13
}

// Switch type names for Settings/Type display - RGB types all show as "RGB control"
const SWITCH_TYPE_NAMES = {
  [SWITCH_TYPE_MAP.MOMENTARY]: 'Momentary',
  [SWITCH_TYPE_MAP.TOGGLE]: 'Toggle',
  [SWITCH_TYPE_MAP.DIMMABLE]: 'Dimmable',
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: 'Temperature setpoint',
  [SWITCH_TYPE_MAP.STEPPED]: 'Stepped switch',
  [SWITCH_TYPE_MAP.DROPDOWN]: 'Dropdown',
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: 'Basic slider',
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: 'Numeric input',
  [SWITCH_TYPE_MAP.THREE_STATE]: 'Three-state switch',
  [SWITCH_TYPE_MAP.BILGE_PUMP]: 'Bilge pump control',
  [SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]: 'RGB control',
  [SWITCH_TYPE_MAP.CCT_WHEEL]: 'RGB control',
  [SWITCH_TYPE_MAP.RGB_WHITE_DIMMER]: 'RGB control'
}

// Distinct names for ValidTypes bitmask display - RGB types show as distinct variants
const SWITCH_TYPE_BITMASK_NAMES = {
  [SWITCH_TYPE_MAP.MOMENTARY]: 'Momentary',
  [SWITCH_TYPE_MAP.TOGGLE]: 'Toggle',
  [SWITCH_TYPE_MAP.DIMMABLE]: 'Dimmable',
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: 'Temperature setpoint',
  [SWITCH_TYPE_MAP.STEPPED]: 'Stepped switch',
  [SWITCH_TYPE_MAP.DROPDOWN]: 'Dropdown',
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: 'Basic slider',
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: 'Numeric input',
  [SWITCH_TYPE_MAP.THREE_STATE]: 'Three-state switch',
  [SWITCH_TYPE_MAP.BILGE_PUMP]: 'Bilge pump control',
  [SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]: 'RGB wheel',
  [SWITCH_TYPE_MAP.CCT_WHEEL]: 'CCT wheel',
  [SWITCH_TYPE_MAP.RGB_WHITE_DIMMER]: 'RGB+W dimmer'
}

const SWITCH_OUTPUT_CONFIG = {
  [SWITCH_TYPE_MAP.MOMENTARY]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.TOGGLE]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.DIMMABLE]: 3, // passthrough + state + dimming value
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: 2, // passthrough + temperature value
  [SWITCH_TYPE_MAP.STEPPED]: 3, // passthrough + state + stepped value
  [SWITCH_TYPE_MAP.DROPDOWN]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: 2, // passthrough + slider value
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: 3, // passthrough + state + numeric value
  [SWITCH_TYPE_MAP.THREE_STATE]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.BILGE_PUMP]: 2, // passthrough + state
  [SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]: 3, // passthrough + state + lightcontrols
  [SWITCH_TYPE_MAP.CCT_WHEEL]: 3, // passthrough + state + lightcontrols
  [SWITCH_TYPE_MAP.RGB_WHITE_DIMMER]: 3 // passthrough + state + lightcontrols
}

// Will default to 'State' if not defined here
const SWITCH_SECOND_OUTPUT_LABEL = {
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: 'Temperature',
  [SWITCH_TYPE_MAP.DROPDOWN]: 'Selected',
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: 'Value'
}

const SWITCH_THIRD_OUTPUT_LABEL = {
  [SWITCH_TYPE_MAP.DIMMABLE]: 'Dimming',
  [SWITCH_TYPE_MAP.STEPPED]: 'Value',
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: 'Value',
  [SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]: 'LightControls',
  [SWITCH_TYPE_MAP.CCT_WHEEL]: 'LightControls',
  [SWITCH_TYPE_MAP.RGB_WHITE_DIMMER]: 'LightControls'
}

// Default debounce delay for virtual device property writes (in milliseconds)
const DEBOUNCE_DELAY_MS = 300

module.exports = {
  SWITCH_TYPE_MAP,
  SWITCH_TYPE_NAMES,
  SWITCH_TYPE_BITMASK_NAMES,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL,
  DEBOUNCE_DELAY_MS
}
