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

window.checkGeneratorType = checkGeneratorType
window.SWITCH_TYPE_CONFIGS = SWITCH_TYPE_CONFIGS
window.SWITCH_OUTPUT_CONFIG = SWITCH_OUTPUT_CONFIG
window.SWITCH_SECOND_OUTPUT_LABEL = SWITCH_SECOND_OUTPUT_LABEL
window.SWITCH_THIRD_OUTPUT_LABEL = SWITCH_THIRD_OUTPUT_LABEL
window.renderSwitchConfigRow = renderSwitchConfigRow
window.updateSwitchConfig = updateSwitchConfig
window.checkSelectedVirtualDevice = checkSelectedVirtualDevice
window.validateSwitchConfig = validateSwitchConfig
window.updateBatteryVoltageVisibility = updateBatteryVoltageVisibility
window.calculateOutputs = calculateOutputs
window.updateOutputs = updateOutputs
