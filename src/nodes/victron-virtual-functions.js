/* global $ */

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
  0: { label: 'Momentary', fields: [] },
  1: { label: 'Toggle', fields: [] },
  2: { label: 'Dimmable', fields: [] },
  3: {
    label: 'Temperature setpoint',
    fields: [
      { id: 'min', type: 'number', placeholder: 'Min (°C)', title: 'Min (°C)', style: 'width:80px;' },
      { id: 'max', type: 'number', placeholder: 'Max (°C)', title: 'Max (°C)', style: 'width:80px;' },
      { id: 'step', type: 'number', placeholder: 'Step (°C)', title: 'Step (°C)', style: 'width:80px;' }
    ]
  },
  4: {
    label: 'Stepped switch',
    fields: [
      { id: 'max', type: 'number', placeholder: 'Max steps', title: 'Max steps', style: 'width:80px;', min: 1, max: 7 }
    ]
  },
  // 6: {
  //   label: 'Dropdown',
  //   fields: [
  //     {
  //       id: 'count',
  //       type: 'number',
  //       placeholder: 'Number of options',
  //       title: 'Number of dropdown options',
  //       style: 'width:100px;',
  //       min: '2',
  //       max: '10'
  //     }
  //   ]
  // },
  // 7: {
  //   label: 'Basic slider',
  //   fields: [
  //     { id: 'min', type: 'number', placeholder: 'Min value', title: 'Slider minimum', style: 'width:80px;' },
  //     { id: 'max', type: 'number', placeholder: 'Max value', title: 'Slider maximum', style: 'width:80px;' },
  //     { id: 'step', type: 'number', placeholder: 'Step size', title: 'Step size', style: 'width:80px;' },
  //     { id: 'unit', type: 'text', placeholder: 'Unit', title: 'Unit', style: 'width:80px;' }
  //   ]
  // },
  8: {
    label: 'Numeric input box',
    fields: [
      { id: 'min', type: 'number', placeholder: 'Min value', title: 'Slider minimum', style: 'width:80px;' },
      { id: 'max', type: 'number', placeholder: 'Max value', title: 'Slider maximum', style: 'width:80px;' },
      { id: 'step', type: 'number', placeholder: 'Step size', title: 'Step size', style: 'width:80px;' },
      { id: 'unit', type: 'text', placeholder: 'Unit', title: 'Unit (center)', style: 'width:120px;' }
    ]
  },
  9: {
    label: 'Three-state switch',
    fields: [] // No extra config fields
  }
}

export function renderSwitchConfigRow (i, context) {
  const typeOptions = Object.entries(SWITCH_TYPE_CONFIGS)
    .map(([value, cfg]) => `<option value="${value}">${cfg.label}</option>`)
    .join('')
  const switchRow = $(`
        <div class="form-row">
            <label for="node-input-switch_${i}_type"><i class="fa fa-toggle-on"></i> Switch ${i} type</label>
            <select id="node-input-switch_${i}_type" data-switch-index="${i}">${typeOptions}</select>
        </div>
    `)
  $('#switch-config-container').append(switchRow)

  const savedType = context[`switch_${i}_type`] !== undefined ? context[`switch_${i}_type`] : 1
  $(`#node-input-switch_${i}_type`).val(String(savedType))

  function renderTypeConfig () {
    $(`#switch-${i}-config-row`).remove()
    $(`#switch-${i}-pairs-row`).remove()

    const type = $(`#node-input-switch_${i}_type`).val()
    const cfg = SWITCH_TYPE_CONFIGS[type]

    if (cfg && cfg.fields.length) {
      const fieldsHtml = cfg.fields.map(field => {
        // Allow decimals for step size fields
        const stepAttr = field.id === 'step' || field.id === 'stepsize' ? 'step="any"' : ''
        return `<input type="${field.type}" id="node-input-switch_${i}_${field.id}" placeholder="${field.placeholder}" title="${field.title}" style="${field.style}" ${field.min ? `min="${field.min}"` : ''} ${field.max ? `max="${field.max}"` : ''} ${stepAttr} required>`
      }).join('')

      const configRow = $(`
                <div class="form-row" id="switch-${i}-config-row">
                    <label>${cfg.label} Config</label>
                    <div style="display:flex;gap:8px;">${fieldsHtml}</div>
                </div>
            `)
      $(`#node-input-switch_${i}_type`).closest('.form-row').after(configRow)

      // Restore saved values
      cfg.fields.forEach(field => {
        const val = context[`switch_${i}_${field.id}`]
        if (typeof val !== 'undefined') {
          $(`#node-input-switch_${i}_${field.id}`).val(val)
        }
      })

      // Special handling for dropdown type
      if (type === '6') {
        if (!context[`switch_${i}_count`]) {
          const savedLabel = context[`switch_${i}_label`]
          if (savedLabel) {
            try {
              const keyValueObj = JSON.parse(savedLabel)
              const keyCount = Object.keys(keyValueObj).length
              if (keyCount > 0) {
                $(`#node-input-switch_${i}_count`).val(keyCount)
              }
            } catch (e) {
              $(`#node-input-switch_${i}_count`).val(2) // default count
            }
          } else {
            $(`#node-input-switch_${i}_count`).val(2) // default count
          }
        }

        renderDropdownPairs(i, context)

        // Watch count field changes
        $(`#node-input-switch_${i}_count`).on('change', () => {
          renderDropdownPairs(i, context)
        })
      }
    }
  }

  $(`#node-input-switch_${i}_type`).on('change', renderTypeConfig)
  renderTypeConfig()
}

function renderDropdownPairs (i, context) {
  $(`#switch-${i}-pairs-row`).remove()

  const count = parseInt($(`#node-input-switch_${i}_count`).val()) || 2

  // Create pairs container
  const pairsContainer = $(`
    <div class="form-row" id="switch-${i}-pairs-row">
        <label>Options</label>
        <div id="switch-${i}-pairs-container" style="display:flex;flex-direction:column;gap:4px;"></div>
    </div>
  `)
  $(`#switch-${i}-config-row`).after(pairsContainer)

  // Parse saved data from key-value object format
  let savedKeyValues = {}
  const savedLabel = context[`switch_${i}_label`]
  if (savedLabel) {
    try {
      savedKeyValues = JSON.parse(savedLabel)
    } catch (e) {
      savedKeyValues = {}
    }
  }

  // Convert to array for form rendering (preserve order as much as possible)
  const keyValueArray = Object.entries(savedKeyValues)

  // Create input pairs
  for (let j = 0; j < count; j++) {
    const [key, value] = keyValueArray[j] || ['', '']
    const pairHtml = $(`
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" 
               id="node-input-switch_${i}_key_${j}" 
               placeholder="Key" 
               style="width:120px;" 
               value="${key}" required>
        <span>=</span>
        <input type="text" 
               id="node-input-switch_${i}_value_${j}" 
               placeholder="Display Value" 
               style="width:120px;" 
               value="${value}" required>
      </div>
    `)
    $(`#switch-${i}-pairs-container`).append(pairHtml)
  }
}

export function updateSwitchConfig () {
  const count = parseInt($('#node-input-switch_count').val()) || 1
  const container = $('#switch-config-container')
  container.empty()
  if ($('select#node-input-device').val() !== 'switch') return
  for (let i = 1; i <= count; i++) {
    renderSwitchConfigRow(i, this)
  }
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

export function checkSelectedVirtualDevice () {
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
    updateSwitchConfig.call(this)

    $('#node-input-switch_count').off('change.switch-config').on('change.switch-config', () => {
      updateSwitchConfig.call(this)
    })
  }
}

export function validateSwitchConfig () {
  const count = parseInt($('#node-input-switch_count').val()) || 1
  for (let i = 1; i <= count; i++) {
    const type = $(`#node-input-switch_${i}_type`).val()
    const cfg = SWITCH_TYPE_CONFIGS[type]

    if (cfg && cfg.fields.length) {
      for (const field of cfg.fields) {
        const $input = $(`#node-input-switch_${i}_${field.id}`)
        if ($input.length && !$input.val()) {
          $input[0].setCustomValidity('This field is required')
          $input[0].reportValidity()
          return false
        } else if ($input.length) {
          // Only validate integer for stepped switch max, not for step size
          if (field.id === 'max' && type === '4') {
            const maxVal = parseInt($input.val(), 10)
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
    if (type === '6') {
      const pairCount = parseInt($(`#node-input-switch_${i}_count`).val()) || 2
      for (let j = 0; j < pairCount; j++) {
        const $key = $(`#node-input-switch_${i}_key_${j}`)
        const $value = $(`#node-input-switch_${i}_value_${j}`)

        if ($key.length && !$key.val()) {
          $key[0].setCustomValidity('Key is required')
          $key[0].reportValidity()
          return false
        }
        if ($value.length && !$value.val()) {
          $value[0].setCustomValidity('Value is required')
          $value[0].reportValidity()
          return false
        }

        if ($key.length) $key[0].setCustomValidity('')
        if ($value.length) $value[0].setCustomValidity('')
      }
    }
  }
  return true
}
