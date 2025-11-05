// src/nodes/victron-virtual-browser.js
import {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL,
  renderSwitchConfigRow,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  validateSwitchConfig,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs
} from './victron-virtual-functions.js'

window.__victron = {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL,
  renderSwitchConfigRow,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  validateSwitchConfig,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs
}
