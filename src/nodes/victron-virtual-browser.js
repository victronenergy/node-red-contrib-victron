import {
  checkGeneratorType,
  SWITCH_TYPE_CONFIGS,
  renderSwitchConfigRow,
  updateSwitchConfig,
  checkSelectedVirtualDevice,
  validateSwitchConfig,
  updateBatteryVoltageVisibility
} from './victron-virtual-functions.js'

window.checkGeneratorType = checkGeneratorType
window.SWITCH_TYPE_CONFIGS = SWITCH_TYPE_CONFIGS
window.renderSwitchConfigRow = renderSwitchConfigRow
window.updateSwitchConfig = updateSwitchConfig
window.checkSelectedVirtualDevice = checkSelectedVirtualDevice
window.validateSwitchConfig = validateSwitchConfig
window.updateBatteryVoltageVisibility = updateBatteryVoltageVisibility
