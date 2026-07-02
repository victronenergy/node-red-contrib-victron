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
  fetchEvChargers,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs,
  renderIndicatorDocBox,
  updateIndicatorLivePreview,
  renderShowInUICheckboxes,
  getShowUIValue,
  getVirtualNodeLabel,
  determineOutputLabel,
  setDeviceCapabilities,
  getDeviceCapabilities,
  fetchDeviceCapabilities
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
  fetchEvChargers,
  updateBatteryVoltageVisibility,
  calculateOutputs,
  updateOutputs,
  renderIndicatorDocBox,
  updateIndicatorLivePreview,
  renderShowInUICheckboxes,
  getShowUIValue,
  initializeTooltips,
  getVirtualNodeLabel,
  determineOutputLabel,
  setDeviceCapabilities,
  getDeviceCapabilities,
  fetchDeviceCapabilities
}

// Node-RED can call a node's outputLabels(index) (-> determineOutputLabel) to draw port
// tooltips for any node already on the canvas, independent of whether its edit dialog has
// ever been opened - so warm the device-capability cache as soon as this script loads rather
// than waiting for oneditprepare. If this hasn't resolved yet when a label/output-count is
// requested, calculateOutputs/determineOutputLabel fall back to their non-S2 defaults and
// self-correct on the next render once the fetch completes.
try {
  const baseUrl = (window.RED?.settings?.httpNodeRoot || window.RED?.settings?.httpAdminRoot || '').replace(/\/$/, '')
  fetchDeviceCapabilities(baseUrl).then(setDeviceCapabilities).catch(() => {})
} catch (e) { /* RED not ready yet; oneditprepare's fetch will populate the cache */ }
