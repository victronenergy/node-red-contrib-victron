// src/nodes/victron-virtual-browser.js
import {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
  renderSwitchConfigRow,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  validateSwitchConfig,
  fetchSwitchNodeNameAndGroupFromCache,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs
} from './victron-virtual-functions.js'
import { initializeTooltips } from './victron-common.js'

window.__victron = {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
  renderSwitchConfigRow,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  validateSwitchConfig,
  fetchSwitchNodeNameAndGroupFromCache,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs,
  initializeTooltips
}
