// src/nodes/victron-virtual-browser.js
import {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
  SWITCH_OUTPUT_CONFIG,
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
window.renderSwitchConfigRow = renderSwitchConfigRow
window.updateSwitchConfig = updateSwitchConfig
window.checkSelectedVirtualDevice = checkSelectedVirtualDevice
window.validateSwitchConfig = validateSwitchConfig
window.updateBatteryVoltageVisibility = updateBatteryVoltageVisibility
window.calculateOutputs = calculateOutputs
window.updateOutputs = updateOutputs
