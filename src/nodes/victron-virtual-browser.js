// src/nodes/victron-virtual-browser.js
import {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
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
  renderSwitchConfigRow,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  validateSwitchConfig,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs
}
