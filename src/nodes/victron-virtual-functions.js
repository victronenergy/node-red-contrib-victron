/* global $ */

import {
  SWITCH_TYPE_MAP,
  SWITCH_TYPE_NAMES,
  SWITCH_TYPE_BITMASK_NAMES,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL
} from './victron-virtual-constants'
import { initializeTooltips } from './victron-common'

// Re-export for browser/test use
export {
  SWITCH_TYPE_MAP,
  SWITCH_TYPE_NAMES,
  SWITCH_TYPE_BITMASK_NAMES,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL
}

const COMMON_SWITCH_FIELDS = [
  { id: 'customname', type: 'text', placeholder: 'Name', title: 'Name', tooltip: 'Custom name for the switch. If the custom name gets changed in the gui after initial deploy, that value will be overwritten on restart and re-deploy of Node-RED.' },
  { id: 'group', type: 'text', placeholder: 'Group', title: 'Group', tooltip: 'Group name for the switch. If the group gets changed in the gui after initial deploy, that value will be overwritten on restart and re-deploy of Node-RED.' }
]

export function checkGeneratorType () {
  const generatorType = $('select#node-input-generator_type').val()
  if (generatorType === 'dc') {
    $('.dc-generator-only').show()
    $('.ac-generator-only').hide()
  } else {
    $('.dc-generator-only').hide()
    $('.ac-generator-only').show()
  }
}

export const SWITCH_TYPE_CONFIGS = {
  [SWITCH_TYPE_MAP.MOMENTARY]: { label: 'Momentary', fields: [...COMMON_SWITCH_FIELDS] },
  [SWITCH_TYPE_MAP.TOGGLE]: { label: 'Toggle', fields: [...COMMON_SWITCH_FIELDS] },
  [SWITCH_TYPE_MAP.DIMMABLE]: { label: 'Dimmable', fields: [...COMMON_SWITCH_FIELDS] },
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: {
    label: 'Temperature setpoint',
    fields: [
      ...COMMON_SWITCH_FIELDS,
      { id: 'min', type: 'number', placeholder: 'Min (°C)', title: 'Min (°C)' },
      { id: 'max', type: 'number', placeholder: 'Max (°C)', title: 'Max (°C)' },
      { id: 'step', type: 'number', placeholder: 'Step (°C)', title: 'Step (°C)' }
    ]
  },
  [SWITCH_TYPE_MAP.STEPPED]: {
    label: 'Stepped switch',
    fields: [
      ...COMMON_SWITCH_FIELDS,
      { id: 'max', type: 'number', placeholder: 'Max steps', title: 'Max steps', min: 1, max: 7 }
    ]
  },
  [SWITCH_TYPE_MAP.DROPDOWN]: {
    label: 'Dropdown',
    fields: [
      ...COMMON_SWITCH_FIELDS,
      {
        id: 'count',
        type: 'number',
        placeholder: 'Number of options',
        title: 'Number of dropdown options',
        min: '2',
        max: '10'
      }
    ]
  },
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: {
    label: 'Basic slider',
    fields: [
      ...COMMON_SWITCH_FIELDS,
      { id: 'min', type: 'number', placeholder: 'Min value', title: 'Slider minimum' },
      { id: 'max', type: 'number', placeholder: 'Max value', title: 'Slider maximum' },
      { id: 'step', type: 'number', placeholder: 'Step size', title: 'Step size' },
      { id: 'unit', type: 'text', placeholder: 'Unit', title: 'Unit' }
    ]
  },
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: {
    label: 'Numeric input',
    fields: [
      ...COMMON_SWITCH_FIELDS,
      { id: 'min', type: 'number', placeholder: 'Min value', title: 'Slider minimum' },
      { id: 'max', type: 'number', placeholder: 'Max value', title: 'Slider maximum' },
      { id: 'step', type: 'number', placeholder: 'Step size', title: 'Step size' },
      { id: 'unit', type: 'text', placeholder: 'Unit', title: 'Unit (center)' }
    ]
  },
  [SWITCH_TYPE_MAP.THREE_STATE]: {
    label: 'Three-state switch',
    fields: [...COMMON_SWITCH_FIELDS]
  },
  [SWITCH_TYPE_MAP.BILGE_PUMP]: {
    label: 'Bilge pump control',
    fields: [...COMMON_SWITCH_FIELDS]
  },
  [SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]: {
    label: 'RGB control',
    fields: [...COMMON_SWITCH_FIELDS],
    isRgbControl: true
  }
}

const INPUT_DOCS = `
  <div>
    <strong>Input:</strong><ol><li>JavaScript object with at least one property/value. E.g. <code>{path: value}</code> or <code>{path1: value1, path2: value2}</code> pairs.</li></ol>
  </div>
`

const createDocTemplate = (paths, outputs, img) => ({
  text: `
    ${INPUT_DOCS}
    <div style="margin-bottom: 10px;">
      ${paths}
    </div>
    <div>
      ${outputs}
    </div>
  `,
  img
})

export const SWITCH_TYPE_DOCS = {
  [SWITCH_TYPE_MAP.MOMENTARY]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of channel, separate from dimming.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the switch</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/momentary.svg'
  ),
  [SWITCH_TYPE_MAP.TOGGLE]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of channel, separate from dimming.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the switch</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/toggle.svg'
  ),
  [SWITCH_TYPE_MAP.DIMMABLE]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of channel, separate from dimming.</li><li><code>/SwitchableOutput/output_1/Dimming</code> &mdash; 0 to 100%, read/write.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the switch</li><li><code>Dimming</code> &mdash; <tt>msg.payload</tt> contains the dimming value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/dimmable.svg'
  ),
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: createDocTemplate(
    `<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Dimming</code> &mdash; holds slider value in °C.</li><li><code>/SwitchableOutput/output_1/Measurement</code> &mdash; holds temperature measurement, if available.<br>
      <span style="font-size:0.95em;color:#666;">If present, the actual value will be displayed on the control.</span>
    </li><li><code>/SwitchableOutput/x/Settings/DimmingMin</code> defines slider minimum value. 0 will be used if omitted.</li><li><code>/SwitchableOutput/x/Settings/DimmingMax</code> defines slider maximum value. 100 will be used if omitted.</li><li><code>/SwitchableOutput/x/Settings/StepSize</code> defines stepsize. Stepsize = 1°C if omitted.</li></ul></div>`,
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>Temperature</code> &mdash; <tt>msg.payload</tt> contains the temperature value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/temp_setpoint.svg'
  ),
  [SWITCH_TYPE_MAP.STEPPED]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Dimming</code> &mdash; holds selected option.</li><li><code>/SwitchableOutput/output_1/Settings/DimmingMax</code> &mdash; defines the number of options. Mandatory for this type.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the  on/off state of the switch</li><li><code>Value</code> &mdash; <tt>msg.payload</tt> contains the stepped value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/stepped.svg'
  ),
  [SWITCH_TYPE_MAP.DROPDOWN]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Dimming</code> &mdash; holds selected option.</li><li><code>/SwitchableOutput/output_1/Settings/Labels</code> &mdash; defines the labels as a string array: <tt>[\'Label 1\', \'Label 2\', \'Label 3\']</tt>. Mandatory for this type.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>Selected</code> &mdash; <tt>msg.payload</tt> contains the index of the selected option (<tt>0</tt> for the first item in the list)</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/dropdown.svg'
  ),
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Value</code> &mdash; holds the current slider position.</li><li><code>/SwitchableOutput/output_1/Settings/Min</code> &mdash; defines slider minimum value. <tt>0</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/Max</code> &mdash; defines slider maximum value. <tt>100</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/StepSize</code> &mdash; defines stepsize. Stepsize = <tt>1</tt> if omitted.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>Value</code> &mdash; <tt>msg.payload</tt> contains the slider value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/basic_slider.svg'
  ),
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Value</code> &mdash; holds the current numeric value.</li><li><code>/SwitchableOutput/output_1/Settings/Min</code> &mdash; defines the minimum value. <tt>0</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/Max</code> &mdash; defines the maximum value. <tt>100</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/StepSize</code> &mdash; defines stepsize. Stepsize = <tt>1</tt> if omitted.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the  on/off state of the switch</li><li><code>Value</code> &mdash; <tt>msg.payload</tt> contains the numeric value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/numeric_input.svg'
  ),
  [SWITCH_TYPE_MAP.THREE_STATE]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; holds the current state (e.g., Off, Auto, On).</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains the current state</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/three_state.svg'
  ),
  [SWITCH_TYPE_MAP.BILGE_PUMP]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of channel, separate from dimming.</li><li><code>/SwitchableOutput/output_1/Alarm</code> &mdash; Indicates if an alarm condition is present (e.g., high water level).</li><li><code>/SwitchableOutput/output_1/Measurement</code> &mdash; If supported by the connected device, this path may provide additional measurement data, such as water level percentage.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the pump</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/bilge_pump.svg'
  ),
  [SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]: createDocTemplate(
    `<div><strong>Most relevant path(s):</strong><ul>
      <li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of the light.</li>
      <li><code>/SwitchableOutput/output_1/LightControls</code> &mdash; Array of 5 integers: <tt>[Hue (0-360°), Saturation (0-100%), Brightness (0-100%), White (0-100%), ColorTemperature (0-6500K)]</tt>.
        <br><span style="font-size:0.95em;color:#666;">Array elements used depend on selected control types:<br>
        • RGB color wheel: Hue, Saturation, Brightness<br>
        • CCT wheel: Brightness, ColorTemperature<br>
        • RGB + white dimmer: Hue, Saturation, Brightness, White</span>
      </li>
    </ul></div>`,
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the light</li><li><code>LightControls</code> &mdash; <tt>msg.payload</tt> contains the 5-element array with color and brightness values. Additional convenience fields: <tt>msg.rgb</tt> (hex string, e.g. #FF0000), <tt>msg.hsb</tt> (object with hue, saturation, brightness), <tt>msg.white</tt> (0-100%), <tt>msg.colorTemperature</tt> (Kelvin)</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/rgb_cct_control.svg'
  )
}

export function renderSwitchConfigRow (context) {
  const typeOptions = Object.entries(SWITCH_TYPE_CONFIGS)
    .map(([value, cfg]) => `<option value="${value}">${cfg.label}</option>`)
    .join('')
  const switchRow = $(`
        <div class="form-row">
            <label for="node-input-switch_1_type"><i class="fa fa-toggle-on"></i> Switch type</label>
            <select id="node-input-switch_1_type">${typeOptions}</select>
        </div>
    `)
  $('#switch-config-container').append(switchRow)

  const savedType = context.switch_1_type !== undefined ? context.switch_1_type : SWITCH_TYPE_MAP.TOGGLE
  $('#node-input-switch_1_type').val(String(savedType))

  function renderTypeConfig () {
    $('#switch-1-config-row').remove()
    $('#switch-1-pairs-row').remove()
    $('#switch-1-doc-row').remove()

    const type = $('#node-input-switch_1_type').val()
    const cfg = SWITCH_TYPE_CONFIGS[type]
    const doc = SWITCH_TYPE_DOCS[type]

    if (cfg && cfg.fields.length) {
      // Render each field as a separate row
      const fieldsHtml = cfg.fields.map(field => {
        const stepAttr = field.id === 'step' || field.id === 'stepsize' ? 'step="any"' : ''
        const tooltipHtml = field.tooltip
          ? `<i class="fa fa-info-circle tooltip-icon"
                data-tooltip="${field.tooltip}"></i>`
          : ''

        return `
          <div class="form-row">
            <label for="node-input-switch_1_${field.id}">
              ${field.title || field.placeholder}${tooltipHtml}
            </label>
            <input type="${field.type}" id="node-input-switch_1_${field.id}"
                  placeholder="${field.placeholder}"
                  ${stepAttr} required>
          </div>
        `
      }).join('')

      // Build the config row
      const configRow = $(`
        <div id="switch-1-config-row">
          <label style="font-weight:bold;">${cfg.label} configuration</label>
          ${fieldsHtml}
        </div>
      `)
      $('#node-input-switch_1_type').closest('.form-row').after(configRow)

      // Restore saved values
      cfg.fields.forEach(field => {
        const val = context[`switch_1_${field.id}`]
        if (typeof val !== 'undefined') {
          $(`#node-input-switch_1_${field.id}`).val(val)
        }

        const $input = $(`#node-input-switch_1_${field.id}`)

        // Add validation for stepped switch max field
        if (field.id === 'max' && Number(type) === SWITCH_TYPE_MAP.STEPPED) {
          $input.on('blur input', function () {
            const val = $(this).val()
            const maxVal = parseInt(val, 10)

            if (!val) {
              // Empty field - will be caught by required validation
              this.setCustomValidity('This field is required')
              this.reportValidity()
            } else if (isNaN(maxVal) || maxVal < 1 || maxVal > 7) {
              this.setCustomValidity('Max steps must be between 1 and 7')
              this.reportValidity()
            } else {
              // Valid - clear any error
              this.setCustomValidity('')
            }
          })
        }
      })

      // Special handling for dropdown type
      if (String(type) === String(SWITCH_TYPE_MAP.DROPDOWN)) {
        // Restore count for dropdown options
        let restoredCount = 2 // default
        const savedLabel = context.switch_1_label
        if (!context.switch_1_count && savedLabel) {
          try {
            const parsed = JSON.parse(savedLabel)
            // If legacy format (object), use its key count
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              restoredCount = Object.keys(parsed).length || 2
            }
            // If new format (array), use its length
            if (Array.isArray(parsed)) {
              restoredCount = parsed.length || 2
            }
          } catch (e) {
            restoredCount = 2
          }
          $('#node-input-switch_1_count').val(restoredCount)
        } else if (context.switch_1_count) {
          $('#node-input-switch_1_count').val(context.switch_1_count)
        }

        renderDropdownLabels(context)

        // Watch count field changes
        $('#node-input-switch_1_count').on('change', () => {
          renderDropdownLabels(context)
        })
      }

      initializeTooltips()
    }

    if (doc) {
      const docRow = $(`
        <div class="form-row">
          <div id="switch-1-doc-row" class="victron-doc-box">
            <label>${cfg.label} usage</label>
            ${doc.img ? `<img src="${doc.img}" alt="Switch type preview">` : ''}
            <div class="victron-doc-text">${doc.text}</div>
          </div>
        </div>
      `)
      // Append to the dedicated switch docs container (after default values)
      $('#switch-docs-container').append(docRow)
    }

    if (Number(type) === SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT) {
      // Add checkbox for Measurement path
      const measurementToggle = $(`
        <div class="form-row victron-checkbox" id="switch-1-measurement-toggle-row">
          <input type="checkbox" id="node-input-switch_1_include_measurement">
          <label for="node-input-switch_1_include_measurement">Include Measurement path</label>
        </div>
      `)
      $('#switch-1-config-row').append(measurementToggle)

      // Restore saved value if present
      if (context.switch_1_include_measurement) {
        $('#node-input-switch_1_include_measurement').prop('checked', true)
      }
    }

    if (cfg && cfg.isRgbControl) {
      // Add RGB control type checkboxes
      const rgbCheckboxes = $(`
        <div id="switch-1-rgb-checkboxes" style="margin-top:10px;">
          <label style="font-weight:bold;">Select RGB control types (at least one required):</label>
          <div class="form-row victron-checkbox">
            <input type="checkbox" id="node-input-switch_1_rgb_color_wheel">
            <label for="node-input-switch_1_rgb_color_wheel">RGB color wheel</label>
          </div>
          <div class="form-row victron-checkbox">
            <input type="checkbox" id="node-input-switch_1_cct_wheel">
            <label for="node-input-switch_1_cct_wheel">CCT wheel</label>
          </div>
          <div class="form-row victron-checkbox">
            <input type="checkbox" id="node-input-switch_1_rgb_white_dimmer">
            <label for="node-input-switch_1_rgb_white_dimmer">RGB color wheel + white dimmer</label>
          </div>
        </div>
      `)
      $('#switch-1-config-row').append(rgbCheckboxes)

      // Restore saved values or default to first checkbox
      const hasAnySaved = context.switch_1_rgb_color_wheel || context.switch_1_cct_wheel || context.switch_1_rgb_white_dimmer

      if (context.switch_1_rgb_color_wheel) {
        $('#node-input-switch_1_rgb_color_wheel').prop('checked', true)
      }
      if (context.switch_1_cct_wheel) {
        $('#node-input-switch_1_cct_wheel').prop('checked', true)
      }
      if (context.switch_1_rgb_white_dimmer) {
        $('#node-input-switch_1_rgb_white_dimmer').prop('checked', true)
      }

      // If no checkboxes are saved (new node), default to first one
      if (!hasAnySaved) {
        $('#node-input-switch_1_rgb_color_wheel').prop('checked', true)
      }

      // Add change handlers to prevent unchecking all boxes
      const rgbCheckboxIds = [
        '#node-input-switch_1_rgb_color_wheel',
        '#node-input-switch_1_cct_wheel',
        '#node-input-switch_1_rgb_white_dimmer'
      ]

      rgbCheckboxIds.forEach(id => {
        $(id).on('change', function () {
          // Count how many are checked
          const checkedCount = rgbCheckboxIds.filter(cbId => $(cbId).is(':checked')).length

          // If trying to uncheck the last one, prevent it
          if (checkedCount === 0) {
            $(this).prop('checked', true)
            this.setCustomValidity('At least one RGB control type must be selected')
            this.reportValidity()
          } else {
            // Clear validation message when at least one is checked
            rgbCheckboxIds.forEach(cbId => {
              $(cbId)[0].setCustomValidity('')
            })
          }
        })
      })
    }
  }

  $('#node-input-switch_1_type').on('change', renderTypeConfig)
  renderTypeConfig()
}

function renderDropdownLabels (context) {
  $('#switch-1-pairs-row').remove()

  const count = parseInt($('#node-input-switch_1_count').val()) || 2

  // Create labels container
  const labelsContainer = $(`
    <div class="form-row" id="switch-1-pairs-row">
        <label>Options</label>
        <div id="switch-1-pairs-container" style="display:flex;flex-direction:column;gap:4px;"></div>
    </div>
  `)
  $('#switch-1-config-row').after(labelsContainer)

  // Parse saved data from string array
  let savedLabels = []
  const savedLabel = context.switch_1_label
  if (savedLabel) {
    try {
      savedLabels = JSON.parse(savedLabel)
    } catch (e) {
      savedLabels = []
    }
  }

  // Create label inputs
  for (let j = 0; j < count; j++) {
    const value = savedLabels[j] || ''
    const labelHtml = $(`
      <div class="form-row" style="align-items:center;">
        <label for="node-input-switch_1_value_${j}" style="min-width:120px;">Option ${j + 1}</label>
        <input type="text"
               id="node-input-switch_1_value_${j}"
               placeholder="Label"
               style="width:180px;"
               value="${value}" required>
      </div>
    `)
    $('#switch-1-pairs-container').append(labelHtml)
  }
}

export function updateSwitchConfig (context) {
  const container = $('#switch-config-container')
  container.empty()
  // Also clear the docs container
  $('#switch-docs-container').empty()
  if ($('select#node-input-device').val() !== 'switch') return
  renderSwitchConfigRow(context)

  // Add handler for switch type changes
  $('#node-input-switch_1_type').on('change', (v) => {
    context.switch_1_type = v.target.value
    updateOutputs(context)
  })
}

export function updateBatteryVoltageVisibility () {
  const defaultValues = $('#node-input-default_values-yes').is(':checked')
  const preset = $('#node-input-battery_voltage_preset').val()

  // Show voltage row only when default values is enabled
  $('#battery-voltage-row').toggle(defaultValues)

  // Show custom input only when custom is selected
  $('#node-input-battery_voltage_custom').toggle(preset === 'custom')
  $('#battery-voltage-custom-label').toggle(preset === 'custom')
}

export function checkSelectedVirtualDevice (context) {
  [
    'acload', 'battery', 'generator', 'gps', 'grid', 'e-drive',
    'pvinverter', 'switch', 'tank', 'temperature'
  ].forEach(x => { $('.input-' + x).hide() })

  const selected = $('select#node-input-device').val()
  $('.input-' + selected).show()

  if (selected === 'acload') {
    $('#node-input-enable_s2support').off('change.s2support').on('change.s2support', function () {
      context.enable_s2support = $(this).is(':checked')
      updateOutputs(context)
    })
  }

  if (selected === 'battery') {
    $('input[name="default_values"]').off('change.battery-voltage').on('change.battery-voltage', updateBatteryVoltageVisibility)
    $('#node-input-battery_voltage_preset').off('change.battery-voltage').on('change.battery-voltage', updateBatteryVoltageVisibility)
    updateBatteryVoltageVisibility()
  }

  if (selected === 'temperature') {
    $('#node-input-include_temp_battery').off('change').on('change', function () {
      $('#battery-temp_voltage-row').toggle($(this).is(':checked'))
    })
    $('#battery-temp_voltage-row').toggle($('#node-input-include_temp_battery').is(':checked'))
  }

  if (selected === 'tank') {
    $('#node-input-include_tank_battery').off('change').on('change', function () {
      $('#tank_battery-voltage-row').toggle($(this).is(':checked'))
    })
    $('#tank_battery-voltage-row').toggle($('#node-input-include_tank_battery').is(':checked'))
  }

  if (selected === 'generator') {
    checkGeneratorType()
  }

  if (selected === 'gps') {
    $('#node-input-default_values-yes').prop('checked', false)
    $('#node-input-default_values-no').prop('checked', true).prop('disabled', true)
    $('#node-input-default_values-yes').prop('disabled', true)
  } else {
    $('input[name="default_values"]').prop('disabled', false)
  }

  if (selected === 'switch') {
    updateSwitchConfig(context)
    $('#default-values-container').hide()
  } else {
    $('#default-values-container').show()
    $('#switch-docs-container').empty()
  }
}

export function validateSwitchConfig () {
  const type = $('#node-input-switch_1_type').val()
  const cfg = SWITCH_TYPE_CONFIGS[type]

  if (cfg && cfg.fields.length) {
    for (const field of cfg.fields) {
      const $input = $(`#node-input-switch_1_${field.id}`)
      if ($input.length && !$input.val()) {
        $input[0].setCustomValidity('This field is required')
        $input[0].reportValidity()
        return false
      } else if ($input.length) {
        if (field.id === 'max' && Number(type) === SWITCH_TYPE_MAP.STEPPED) {
          const val = $input.val()
          const maxVal = parseInt(val, 10)
          if (isNaN(maxVal) || maxVal < 1 || maxVal > 7) {
            $input[0].setCustomValidity('Max steps must be between 1 and 7')
            $input[0].reportValidity()
            return false
          } else {
            $input[0].setCustomValidity('')
          }
        } else {
          $input[0].setCustomValidity('')
        }
      }
    }
  }

  // Special validation for dropdown type (6)
  if (String(type) === String(SWITCH_TYPE_MAP.DROPDOWN)) {
    const pairCount = parseInt($('#node-input-switch_1_count').val()) || 2
    for (let j = 0; j < pairCount; j++) {
      const $value = $(`#node-input-switch_1_value_${j}`)
      if ($value.length && !$value.val()) {
        $value[0].setCustomValidity('Label is required')
        $value[0].reportValidity()
        return false
      }
      if ($value.length) $value[0].setCustomValidity('')
    }
  }

  // Special validation for RGB control - at least one checkbox must be selected
  if (cfg && cfg.isRgbControl) {
    const rgbColorWheel = $('#node-input-switch_1_rgb_color_wheel').is(':checked')
    const cctWheel = $('#node-input-switch_1_cct_wheel').is(':checked')
    const rgbWhiteDimmer = $('#node-input-switch_1_rgb_white_dimmer').is(':checked')

    if (!rgbColorWheel && !cctWheel && !rgbWhiteDimmer) {
      const $checkbox = $('#node-input-switch_1_rgb_color_wheel')[0]
      if ($checkbox) {
        $checkbox.setCustomValidity('At least one RGB control type must be selected')
        $checkbox.reportValidity()
      }
      return false
    } else {
      // Clear any previous validation messages on all checkboxes
      $('#node-input-switch_1_rgb_color_wheel')[0]?.setCustomValidity('')
      $('#node-input-switch_1_cct_wheel')[0]?.setCustomValidity('')
      $('#node-input-switch_1_rgb_white_dimmer')[0]?.setCustomValidity('')
    }
  }

  return true
}

const DEVICE_TYPE_TO_NUM_OUTPUTS = {
  switch: (config) => {
    // determine outputs based on type
    const switchType = config?.switch_1_type

    // Parse switch type (handle both string and number)
    const typeKey = switchType !== undefined ? parseInt(switchType, 10) : SWITCH_TYPE_MAP.TOGGLE

    // Look up outputs from config, default to 2 (passthrough + state)
    return SWITCH_OUTPUT_CONFIG[typeKey] || 2
  },
  acload: (config) => {
    if (config.enable_s2support) {
      return 2 // passthrough + signals
    }
    return 1
  }
}

/**
 * Calculate the number of outputs for a virtual device
 * @param {string} device - Device type (e.g., 'battery', 'switch', 'gps')
 * @param {object} config - Device configuration object
 * @returns {number} Number of outputs (minimum 1)
 */
export function calculateOutputs (device, config) {
  if (DEVICE_TYPE_TO_NUM_OUTPUTS[device]) {
    return DEVICE_TYPE_TO_NUM_OUTPUTS[device](config)
  } else {
    return 1
  }
}

/**
 * Update the outputs property in the Node-RED editor context
 * This is a thin wrapper around calculateOutputs that handles DOM manipulation
 * @param {object} context - Node-RED editor context (this)
 */
export function updateOutputs (context) {
  const device = context.device
  const config = {
    switch_1_type: context.switch_1_type,
    enable_s2support: context.enable_s2support
  }
  const outputs = calculateOutputs(device, config)

  // Update BOTH the context AND the hidden input field
  context.outputs = outputs
  $('#node-input-outputs').val(outputs)
}

/**
 * Get output labels for a virtual device
 * @param {string} device - Device type (e.g., 'battery', 'switch', 'gps')
 * @param {object} config - Device configuration object
 * @returns {string[]} Array of output label strings
 */
export function getOutputLabels (context = {}) {
  const labels = []
  labels.push('Passthrough')

  if (context.device === 'switch') {
    const switchType = Number(context.switch_1_type || 1)
    const outputCount = SWITCH_OUTPUT_CONFIG[switchType] || 2

    // Second output label
    const secondLabel = SWITCH_SECOND_OUTPUT_LABEL[switchType] || 'State'
    labels.push(secondLabel)

    // Third output label (only if switch has 3 outputs)
    if (outputCount >= 3) {
      const thirdLabel = SWITCH_THIRD_OUTPUT_LABEL[switchType] || 'Value'
      labels.push(thirdLabel)
    }
  }

  return labels
}

/**
 * Check if a switch type is an RGB control type
 * @param {number} switchType - Switch type value
 * @returns {boolean} True if the type is RGB control
 */
export function isRgbControlType (switchType) {
  return switchType === SWITCH_TYPE_MAP.RGB_COLOR_WHEEL ||
    switchType === SWITCH_TYPE_MAP.CCT_WHEEL ||
    switchType === SWITCH_TYPE_MAP.RGB_WHITE_DIMMER
}

/**
 * Calculate ValidTypes bitmask from selected RGB control checkboxes
 * @param {boolean} rgbColorWheel - Whether RGB color wheel is selected
 * @param {boolean} cctWheel - Whether CCT wheel is selected
 * @param {boolean} rgbWhiteDimmer - Whether RGB + white dimmer is selected
 * @returns {number} ValidTypes bitmask (OR'd combination)
 */
export function calculateRgbValidTypes (rgbColorWheel, cctWheel, rgbWhiteDimmer) {
  let validTypes = 0
  if (rgbColorWheel) validTypes |= (1 << SWITCH_TYPE_MAP.RGB_COLOR_WHEEL)
  if (cctWheel) validTypes |= (1 << SWITCH_TYPE_MAP.CCT_WHEEL)
  if (rgbWhiteDimmer) validTypes |= (1 << SWITCH_TYPE_MAP.RGB_WHITE_DIMMER)
  return validTypes
}

/**
 * Get the first selected RGB control type
 * @param {boolean} rgbColorWheel - Whether RGB color wheel is selected
 * @param {boolean} cctWheel - Whether CCT wheel is selected
 * @param {boolean} rgbWhiteDimmer - Whether RGB + white dimmer is selected
 * @returns {number} The first selected type value, or RGB_COLOR_WHEEL as default
 */
export function getFirstRgbType (rgbColorWheel, cctWheel, rgbWhiteDimmer) {
  if (rgbColorWheel) return SWITCH_TYPE_MAP.RGB_COLOR_WHEEL
  if (cctWheel) return SWITCH_TYPE_MAP.CCT_WHEEL
  if (rgbWhiteDimmer) return SWITCH_TYPE_MAP.RGB_WHITE_DIMMER
  return SWITCH_TYPE_MAP.RGB_COLOR_WHEEL // default fallback
}

/**
 * Format bitmask to human-readable string using name mapping
 * @param {number} bitmask - Bitmask value
 * @param {Object} nameMap - Mapping of bit positions to names
 * @returns {string} Comma-separated list of set bits
 */
export function formatBitmask (bitmask, nameMap) {
  if (bitmask == null || bitmask === 0) return 'None'

  const names = []
  for (const [bitPosition, name] of Object.entries(nameMap)) {
    if (bitmask & (1 << bitPosition)) {
      names.push(name)
    }
  }

  return names.length > 0 ? names.join(', ') : 'None'
}

/**
 * Format light controls array for display
 * @param {Array|string} value - Array of light controls or JSON string
 * @param {number} switchType - Switch type value
 * @returns {string} Formatted display string
 */
export function formatLightControls (value, switchType) {
  let arr = value

  // Handle both array and JSON string input for backwards compatibility
  if (typeof value === 'string') {
    try {
      arr = JSON.parse(value)
    } catch (e) {
      return value || ''
    }
  }

  if (!Array.isArray(arr) || arr.length < 5) {
    return String(value) || ''
  }

  if (switchType === SWITCH_TYPE_MAP.RGB_COLOR_WHEEL) {
    return `H:${arr[0]}° S:${arr[1]}% B:${arr[2]}%`
  } else if (switchType === SWITCH_TYPE_MAP.CCT_WHEEL) {
    return `B:${arr[2]}% CT:${arr[4]}K`
  } else if (switchType === SWITCH_TYPE_MAP.RGB_WHITE_DIMMER) {
    return `H:${arr[0]}° S:${arr[1]}% B:${arr[2]}% W:${arr[3]}%`
  }

  return String(value) || ''
}

/**
 * Validates that a payload object is valid for setting virtual device values
 * @param {any} payload - The payload to validate
 * @returns {{ valid: boolean, error?: string, invalidKeys?: string[] }}
 */
export function validateVirtualDevicePayload (payload) {
  // Check if payload is an object
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    const receivedType = Array.isArray(payload) ? 'array' : typeof payload
    return {
      valid: false,
      error: `Invalid payload type: ${receivedType}. Expected: JavaScript object with at least one property/value.`
    }
  }

  // Check if object is empty
  if (Object.keys(payload).length === 0) {
    return {
      valid: false,
      error: 'Received empty object. Expected: JavaScript object with at least one property/value.'
    }
  }

  // Check if all values are valid types (string, number, boolean, null, or array of numbers)
  const invalidEntries = Object.entries(payload).filter(([key, value]) => {
    if (value === null) return false
    if (typeof value === 'string') return false
    if (typeof value === 'number') return false
    if (typeof value === 'boolean') return false
    if (Array.isArray(value)) {
      // Arrays are valid (for LightControls), but should contain only numbers
      return !value.every(item => typeof item === 'number')
    }
    return true
  })

  if (invalidEntries.length > 0) {
    const invalidKeys = invalidEntries.map(([key]) => key).join(', ')
    return {
      valid: false,
      error: `Invalid value types for keys: ${invalidKeys}. Expected: string, number, boolean, null, or array of numbers.`,
      invalidKeys: invalidEntries.map(([key]) => key)
    }
  }

  return { valid: true }
}
