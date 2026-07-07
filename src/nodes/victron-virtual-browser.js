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
  fetchDeviceCapabilities
} from './victron-virtual-functions.js'
import { initializeTooltips } from './victron-common.js'

// Node-RED can call a node's outputLabels(index) (-> determineOutputLabel) to draw port
// tooltips for any node already on the canvas, independent of whether its edit dialog has
// ever been opened. That callback only receives an index, so there is no call site through
// which fresh capability data could be threaded in - it must be readable synchronously from
// somewhere. This object is that one place; every other call site (oneditprepare,
// checkSelectedVirtualDevice, updateOutputs) fetches its own copy and threads it through
// explicitly instead of reading from here.
const canvasDeviceCapabilities = {}

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
  determineOutputLabel: (node, index) => determineOutputLabel(node, index, canvasDeviceCapabilities),
  fetchDeviceCapabilities
}

// Warm canvasDeviceCapabilities as soon as this script loads rather than waiting for
// oneditprepare, so outputLabels() has S2 capability data available for nodes whose dialog
// hasn't been opened this session. If this hasn't resolved yet when a label is requested,
// determineOutputLabel falls back to its non-S2 default and self-corrects on the next render
// once the fetch completes.
try {
  const baseUrl = (window.RED?.settings?.httpNodeRoot || window.RED?.settings?.httpAdminRoot || '').replace(/\/$/, '')
  fetchDeviceCapabilities(baseUrl)
    .then(list => { (list || []).forEach(dt => { canvasDeviceCapabilities[dt.value] = dt }) })
    .catch(() => {})
} catch (e) { /* RED not ready yet; outputLabels falls back to non-S2 defaults until this resolves */ }
