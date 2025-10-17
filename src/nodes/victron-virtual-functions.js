/* global $ */

import {
  SWITCH_TYPE_MAP,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_THIRD_OUTPUT_LABEL
} from './victron-virtual-constants'

// Re-export for browser/test use
export {
  SWITCH_TYPE_MAP,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_THIRD_OUTPUT_LABEL
}

const COMMON_SWITCH_FIELDS = [
  { id: 'customname', type: 'text', placeholder: 'Name', title: 'Name', style: 'width:120px;', tooltip: 'Custom name for the switch' },
  { id: 'group', type: 'text', placeholder: 'Group', title: 'Group', style: 'width:120px;', tooltip: 'Initial group for the switch. If the group gets changed in the gui after initial deploy, the value set there will be persisted (also on re-deploy).' }
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
      { id: 'min', type: 'number', placeholder: 'Min (°C)', title: 'Min (°C)', style: 'width:80px;' },
      { id: 'max', type: 'number', placeholder: 'Max (°C)', title: 'Max (°C)', style: 'width:80px;' },
      { id: 'step', type: 'number', placeholder: 'Step (°C)', title: 'Step (°C)', style: 'width:80px;' }
    ]
  },
  [SWITCH_TYPE_MAP.STEPPED]: {
    label: 'Stepped switch',
    fields: [
      ...COMMON_SWITCH_FIELDS,
      { id: 'max', type: 'number', placeholder: 'Max steps', title: 'Max steps', style: 'width:80px;', min: 1, max: 7 }
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
        style: 'width:100px;',
        min: '2',
        max: '10'
      }
    ]
  },
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: {
    label: 'Basic slider',
    fields: [
      ...COMMON_SWITCH_FIELDS,
      { id: 'min', type: 'number', placeholder: 'Min value', title: 'Slider minimum', style: 'width:80px;' },
      { id: 'max', type: 'number', placeholder: 'Max value', title: 'Slider maximum', style: 'width:80px;' },
      { id: 'step', type: 'number', placeholder: 'Step size', title: 'Step size', style: 'width:80px;' },
      { id: 'unit', type: 'text', placeholder: 'Unit', title: 'Unit', style: 'width:80px;' }
    ]
  },
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: {
    label: 'Numeric input',
    fields: [
      ...COMMON_SWITCH_FIELDS,
      { id: 'min', type: 'number', placeholder: 'Min value', title: 'Slider minimum', style: 'width:80px;' },
      { id: 'max', type: 'number', placeholder: 'Max value', title: 'Slider maximum', style: 'width:80px;' },
      { id: 'step', type: 'number', placeholder: 'Step size', title: 'Step size', style: 'width:80px;' },
      { id: 'unit', type: 'text', placeholder: 'Unit', title: 'Unit (center)', style: 'width:120px;' }
    ]
  },
  [SWITCH_TYPE_MAP.THREE_STATE]: {
    label: 'Three-state switch',
    fields: [...COMMON_SWITCH_FIELDS]
  },
  [SWITCH_TYPE_MAP.BILGE_PUMP]: {
    label: 'Bilge pump control',
    fields: [...COMMON_SWITCH_FIELDS]
  }
}

const INPUT_DOCS = `
  <div>
    <strong>Input:</strong><ol><li>JSON object with <code>{path: value}</code> or <code>{path1: value1, path2: value2}</code> pairs.</li></ol>
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
    '/resources/@victronenergy/node-red-contrib-victron/docs/momentary.png'
  ),
  [SWITCH_TYPE_MAP.TOGGLE]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of channel, separate from dimming.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the switch</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/toggle.png'
  ),
  [SWITCH_TYPE_MAP.DIMMABLE]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of channel, separate from dimming.</li><li><code>/SwitchableOutput/output_1/Dimming</code> &mdash; 0 to 100%, read/write.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the switch</li><li><code>Dimming</code> &mdash; <tt>msg.payload</tt> contains the dimming value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/dimmable.png'
  ),
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: createDocTemplate(
    `<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Dimming</code> &mdash; holds slider value in °C.</li><li><code>/SwitchableOutput/output_1/Measurement</code> &mdash; holds temperature measurement, if available.<br>
      <span style="font-size:0.95em;color:#666;">If present, the actual value will be displayed on the control.</span>
    </li><li><code>/SwitchableOutput/x/Settings/DimmingMin</code> defines slider minimum value. 0 will be used if omitted.</li><li><code>/SwitchableOutput/x/Settings/DimmingMax</code> defines slider maximum value. 100 will be used if omitted.</li><li><code>/SwitchableOutput/x/Settings/StepSize</code> defines stepsize. Stepsize = 1°C if omitted.</li></ul></div>`,
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the  on/off state of the switch</li><li><code>Temperature</code> &mdash; <tt>msg.payload</tt> contains the temperature value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/temp_setpoint.png'
  ),
  [SWITCH_TYPE_MAP.STEPPED]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Dimming</code> &mdash; holds selected option.</li><li><code>/SwitchableOutput/output_1/Settings/DimmingMax</code> &mdash; defines the number of options. Mandatory for this type.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the  on/off state of the switch</li><li><code>Value</code> &mdash; <tt>msg.payload</tt> contains the stepped value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/stepped.png'
  ),
  [SWITCH_TYPE_MAP.DROPDOWN]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Dimming</code> &mdash; holds selected option.</li><li><code>/SwitchableOutput/output_1/Settings/Labels</code> &mdash; defines the labels as a string array: <tt>[‘Label 1’, ‘Label 2’, ‘Label 3’]</tt>. Mandatory for this type.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>Selected</code> &mdash; <tt>msg.payload</tt> contains the index of the selected option (<tt>0</tt> for the first item in the list)</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/dropdown.png'
  ),
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Value</code> &mdash; holds the current slider position.</li><li><code>/SwitchableOutput/output_1/Settings/Min</code> &mdash; defines slider minimum value. <tt>0</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/Max</code> &mdash; defines slider maximum value. <tt>100</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/StepSize</code> &mdash; defines stepsize. Stepsize = <tt>1</tt> if omitted.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the  on/off state of the switch</li><li><code>Temperature</code> &mdash; <tt>msg.payload</tt> contains the temperature value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/basic_slider.png'
  ),
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/Value</code> &mdash; holds the current numeric value.</li><li><code>/SwitchableOutput/output_1/Settings/Min</code> &mdash; defines the minimum value. <tt>0</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/Max</code> &mdash; defines the maximum value. <tt>100</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/StepSize</code> &mdash; defines stepsize. Stepsize = <tt>1</tt> if omitted.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the  on/off state of the switch</li><li><code>Temperature</code> &mdash; <tt>msg.payload</tt> contains the temperature value</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/numeric_input.png'
  ),
  [SWITCH_TYPE_MAP.THREE_STATE]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; holds the current state (e.g., Off, Auto, On).</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains the current state</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/three_state.png'
  ),
  [SWITCH_TYPE_MAP.BILGE_PUMP]: createDocTemplate(
    '<div><strong>Most relevant path(s):</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of channel, separate from dimming.</li><li><code>/SwitchableOutput/output_1/Alarm</code> &mdash; Indicates if an alarm condition is present (e.g., high water level).</li><li><code>/SwitchableOutput/output_1/Measurement</code> &mdash; If supported by the connected device, this path may provide additional measurement data, such as water level percentage.</li></ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the pump</li></ol></div>',
    '/resources/@victronenergy/node-red-contrib-victron/docs/bilge_pump.png'
  )
}

export function initializeSwitchTooltips () {
  $('.switch-tooltip-container').remove()

  $('.switch-field-tooltip-icon').off('mouseenter mouseleave')

  $('.switch-field-tooltip-icon').on('mouseenter', function (e) {
    const $icon = $(this)
    const tooltipText = $icon.attr('data-tooltip')
    const $tooltip = $('<div class="switch-tooltip-container"></div>').text(tooltipText)

    $('body').append($tooltip)

    // Position tooltip
    const iconOffset = $icon.offset()
    const tooltipHeight = $tooltip.outerHeight()
    const tooltipWidth = $tooltip.outerWidth()

    // Position above the icon, centered
    $tooltip.css({
      top: iconOffset.top - tooltipHeight - 8,
      left: iconOffset.left - (tooltipWidth / 2) + ($icon.outerWidth() / 2)
    })

    $icon.data('tooltip-element', $tooltip)
  })

  $('.switch-field-tooltip-icon').on('mouseleave', function () {
    const $icon = $(this)
    const $tooltip = $icon.data('tooltip-element')
    if ($tooltip) {
      $tooltip.remove()
      $icon.removeData('tooltip-element')
    }
  })
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

    if (cfg && cfg.fields.length) {
      // Render each field as a separate row
      const fieldsHtml = cfg.fields.map(field => {
        const stepAttr = field.id === 'step' || field.id === 'stepsize' ? 'step="any"' : ''
        const tooltipHtml = field.tooltip
          ? `<i class="fa fa-info-circle switch-field-tooltip-icon"
                data-tooltip="${field.tooltip}"></i>`
          : ''

        return `
          <div class="form-row" style="align-items:center;">
            <label for="node-input-switch_1_${field.id}" style="min-width:120px;">
              ${field.title || field.placeholder}${tooltipHtml}
            </label>
            <input type="${field.type}" id="node-input-switch_1_${field.id}"
                  placeholder="${field.placeholder}"
                  style="${field.style}"
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

      initializeSwitchTooltips()
    }

    const doc = SWITCH_TYPE_DOCS[type]
    $('#switch-1-doc-row').remove()
    if (doc) {
      const docRow = $(`
        <div id="switch-1-doc-row" class="victron-doc-box">
          <label>${cfg.label} usage</label>
          ${doc.img ? `<img src="${doc.img}" alt="Switch type preview">` : ''}
          <div class="victron-doc-text">${doc.text}</div>
        </div>
      `)
      // Append after the options row if it exists, otherwise after the config row
      if ($('#switch-1-pairs-row').length) {
        $('#switch-1-pairs-row').after(docRow)
      } else {
        $('#switch-1-config-row').after(docRow)
      }
    }

    if (Number(type) === SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT) {
      // Add checkbox for Measurement path
      const measurementToggle = $(`
        <div class="form-row" id="switch-1-measurement-toggle-row">
          <label for="node-input-switch_1_include_measurement" style="min-width:120px;">Include Measurement path</label>
          <input type="checkbox" id="node-input-switch_1_include_measurement">
        </div>
      `)
      $('#switch-1-config-row').append(measurementToggle)

      // Restore saved value if present
      if (context.switch_1_include_measurement) {
        $('#node-input-switch_1_include_measurement').prop('checked', true)
      }
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
  if ($('select#node-input-device').val() !== 'switch') return
  renderSwitchConfigRow(context)

  // Add handler for switch type changes
  $('#node-input-switch_1_type').on('change', (v) => {
    context.switch_1_type = v.target.value
    updateOutputs(context)
  })
}

export function updateBatteryVoltageVisibility () {
  const defaultValues = $('#node-input-default_values').is(':checked')
  const preset = $('#node-input-battery_voltage_preset').val()

  // Show voltage row only when default values is enabled
  $('#battery-voltage-row').toggle(defaultValues)

  // Show custom input only when custom is selected
  $('#node-input-battery_voltage_custom').toggle(preset === 'custom')
  $('#battery-voltage-custom-label').toggle(preset === 'custom')
}

export function checkSelectedVirtualDevice (context) {
  [
    'battery', 'generator', 'gps', 'grid', 'motordrive', 'pvinverter',
    'switch', 'tank', 'temperature'
  ].forEach(x => { $('.input-' + x).hide() })

  const selected = $('select#node-input-device').val()
  $('.input-' + selected).show()

  if (selected === 'battery') {
    $('#node-input-default_values').off('change.battery-voltage').on('change.battery-voltage', updateBatteryVoltageVisibility)
    $('#node-input-battery_voltage_preset').off('change.battery-voltage').on('change.battery-voltage', updateBatteryVoltageVisibility)

    updateBatteryVoltageVisibility()
  }

  if (selected === 'temperature') {
    // Show/hide battery voltage input based on checkbox
    $('#node-input-include-battery').off('change').on('change', function () {
      if ($(this).is(':checked')) {
        $('#battery-voltage-row').show()
      } else {
        $('#battery-voltage-row').hide()
      }
    })

    // Initially set battery voltage visibility
    $('#battery-voltage-row').toggle($('#node-input-include-battery').is(':checked'))
  }

  if (selected === 'generator') {
    checkGeneratorType()
  }

  if (selected === 'gps') {
    $('#node-input-default_values').prop('checked', false).prop('disabled', true)
  } else {
    $('#node-input-default_values').prop('disabled', false)
  }

  if (selected === 'switch') {
    updateSwitchConfig(context)
    // Hide the default values checkbox and info box for switches
    $('#node-input-default_values').closest('.form-row').hide()
    $('#default-values-info').hide()
  } else {
    // Show for other device types
    $('#node-input-default_values').closest('.form-row').show()
    $('#default-values-info').show()
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
  return true
}

/**
 * Calculate the number of outputs for a virtual device
 * @param {string} device - Device type (e.g., 'battery', 'switch', 'gps')
 * @param {object} config - Device configuration object
 * @returns {number} Number of outputs (minimum 1)
 */
export function calculateOutputs (device, config) {
  // Default to 1 output (passthrough) for all non-switch devices
  if (!device || device !== 'switch') {
    return 1
  }

  // For switches, determine outputs based on type
  const switchType = config?.switch_1_type

  // Parse switch type (handle both string and number)
  const typeKey = switchType !== undefined ? parseInt(switchType, 10) : SWITCH_TYPE_MAP.TOGGLE

  // Look up outputs from config, default to 2 (passthrough + state)
  return SWITCH_OUTPUT_CONFIG[typeKey] || 2
}

/**
 * Update the outputs property in the Node-RED editor context
 * This is a thin wrapper around calculateOutputs that handles DOM manipulation
 * @param {object} context - Node-RED editor context (this)
 */
export function updateOutputs (context) {
  const device = context.device
  const config = {
    switch_1_type: context.switch_1_type
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
export function getOutputLabels (device, config) {
  // Non-switch devices only have passthrough
  if (!device || device !== 'switch') {
    return ['Passthrough']
  }

  // For switches, build labels based on output count
  const switchType = config?.switch_1_type
  const typeKey = switchType !== undefined ? parseInt(switchType, 10) : SWITCH_TYPE_MAP.TOGGLE
  const outputCount = SWITCH_OUTPUT_CONFIG[typeKey] || 2

  // Start with common labels
  const labels = ['Passthrough']

  // For dropdown, second output is 'Selected' instead of 'State'
  if (outputCount === 2 && typeKey === SWITCH_TYPE_MAP.DROPDOWN) {
    labels.push('Selected')
  } else {
    labels.push('State')
  }

  // Add third label if needed
  if (outputCount === 3) {
    const thirdLabel = SWITCH_THIRD_OUTPUT_LABEL[typeKey] || 'Value'
    labels.push(thirdLabel)
  }

  return labels
}
