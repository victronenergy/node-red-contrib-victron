// src/nodes/victron-virtual-browser.js
import {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
  INDICATOR_TYPE_LABELS,
  renderSwitchConfigRow,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  validateSwitchConfig,
  fetchSwitchNodeNameAndGroupFromCache,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs,
  renderIndicatorDocBox,
  updateIndicatorLivePreview,
  renderShowInUICheckboxes,
  getShowUIValue,
  getVirtualNodeLabel,
  determineOutputLabel
} from './victron-virtual-functions.js'
import { initializeTooltips } from './victron-common.js'

window.__victron = {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
  INDICATOR_TYPE_LABELS,
  renderSwitchConfigRow,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  validateSwitchConfig,
  fetchSwitchNodeNameAndGroupFromCache,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs,
  renderIndicatorDocBox,
  updateIndicatorLivePreview,
  renderShowInUICheckboxes,
  getShowUIValue,
  initializeTooltips,
  getVirtualNodeLabel,
  determineOutputLabel
}
