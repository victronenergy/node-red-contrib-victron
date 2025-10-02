(function () {
  'use strict';

  /* global $ */

  const COMMON_SWITCH_FIELDS = [
    { id: 'customname', type: 'text', placeholder: 'Name', title: 'Name', style: 'width:120px;' },
    { id: 'group', type: 'text', placeholder: 'Group', title: 'Group', style: 'width:120px;' }
  ];

  function checkGeneratorType () {
    const generatorType = $('select#node-input-generator_type').val();
    if (generatorType === 'dc') {
      $('.dc-generator-only').show();
      $('.ac-generator-only').hide();
    } else {
      $('.dc-generator-only').hide();
      $('.ac-generator-only').show();
    }
  }

  const SWITCH_TYPE_CONFIGS = {
    0: { label: 'Momentary', fields: [...COMMON_SWITCH_FIELDS] },
    1: { label: 'Toggle', fields: [...COMMON_SWITCH_FIELDS] },
    2: { label: 'Dimmable', fields: [...COMMON_SWITCH_FIELDS] },
    3: {
      label: 'Temperature setpoint',
      fields: [
        ...COMMON_SWITCH_FIELDS,
        { id: 'min', type: 'number', placeholder: 'Min (°C)', title: 'Min (°C)', style: 'width:80px;' },
        { id: 'max', type: 'number', placeholder: 'Max (°C)', title: 'Max (°C)', style: 'width:80px;' },
        { id: 'step', type: 'number', placeholder: 'Step (°C)', title: 'Step (°C)', style: 'width:80px;' }
      ]
    },
    4: {
      label: 'Stepped switch',
      fields: [
        ...COMMON_SWITCH_FIELDS,
        { id: 'max', type: 'number', placeholder: 'Max steps', title: 'Max steps', style: 'width:80px;', min: 1, max: 7 }
      ]
    },
    6: {
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
    7: {
      label: 'Basic slider',
      fields: [
        ...COMMON_SWITCH_FIELDS,
        { id: 'min', type: 'number', placeholder: 'Min value', title: 'Slider minimum', style: 'width:80px;' },
        { id: 'max', type: 'number', placeholder: 'Max value', title: 'Slider maximum', style: 'width:80px;' },
        { id: 'step', type: 'number', placeholder: 'Step size', title: 'Step size', style: 'width:80px;' },
        { id: 'unit', type: 'text', placeholder: 'Unit', title: 'Unit', style: 'width:80px;' }
      ]
    },
    8: {
      label: 'Numeric input',
      fields: [
        ...COMMON_SWITCH_FIELDS,
        { id: 'min', type: 'number', placeholder: 'Min value', title: 'Slider minimum', style: 'width:80px;' },
        { id: 'max', type: 'number', placeholder: 'Max value', title: 'Slider maximum', style: 'width:80px;' },
        { id: 'step', type: 'number', placeholder: 'Step size', title: 'Step size', style: 'width:80px;' },
        { id: 'unit', type: 'text', placeholder: 'Unit', title: 'Unit (center)', style: 'width:120px;' }
      ]
    },
    9: {
      label: 'Three-state switch',
      fields: [...COMMON_SWITCH_FIELDS]
    },
    10: {
      label: 'Bilge pump control',
      fields: [...COMMON_SWITCH_FIELDS]
    }
  };

  function renderSwitchConfigRow (context) {
    const typeOptions = Object.entries(SWITCH_TYPE_CONFIGS)
      .map(([value, cfg]) => `<option value="${value}">${cfg.label}</option>`)
      .join('');
    const switchRow = $(`
        <div class="form-row">
            <label for="node-input-switch_1_type"><i class="fa fa-toggle-on"></i> Switch type</label>
            <select id="node-input-switch_1_type">${typeOptions}</select>
        </div>
    `);
    $('#switch-config-container').append(switchRow);

    const savedType = context.switch_1_type !== undefined ? context.switch_1_type : 1;
    $('#node-input-switch_1_type').val(String(savedType));

    function renderTypeConfig () {
      $('#switch-1-config-row').remove();
      $('#switch-1-pairs-row').remove();

      const type = $('#node-input-switch_1_type').val();
      const cfg = SWITCH_TYPE_CONFIGS[type];

      if (cfg && cfg.fields.length) {
        // Render each field as a separate row
        const fieldsHtml = cfg.fields.map(field => {
          const stepAttr = field.id === 'step' || field.id === 'stepsize' ? 'step="any"' : '';
          return `
          <div class="form-row" style="align-items:center;">
            <label for="node-input-switch_1_${field.id}" style="min-width:120px;">${field.title || field.placeholder}</label>
            <input type="${field.type}" id="node-input-switch_1_${field.id}"
                   placeholder="${field.placeholder}"
                   style="${field.style}"
                   ${field.min ? `min="${field.min}"` : ''}
                   ${field.max ? `max="${field.max}"` : ''}
                   ${stepAttr} required>
          </div>
        `
        }).join('');

        // Build the config row
        const configRow = $(`
        <div id="switch-1-config-row">
          <label style="font-weight:bold;">${cfg.label} configuration</label>
          ${fieldsHtml}
        </div>
      `);
        $('#node-input-switch_1_type').closest('.form-row').after(configRow);

        // Restore saved values
        cfg.fields.forEach(field => {
          const val = context[`switch_1_${field.id}`];
          if (typeof val !== 'undefined') {
            $(`#node-input-switch_1_${field.id}`).val(val);
          }
        });

        // Special handling for dropdown type
        if (type === '6') {
          // Restore count for dropdown options
          let restoredCount = 2; // default
          const savedLabel = context.switch_1_label;
          if (!context.switch_1_count && savedLabel) {
            try {
              const parsed = JSON.parse(savedLabel);
              // If legacy format (object), use its key count
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                restoredCount = Object.keys(parsed).length || 2;
              }
              // If new format (array), use its length
              if (Array.isArray(parsed)) {
                restoredCount = parsed.length || 2;
              }
            } catch (e) {
              restoredCount = 2;
            }
            $('#node-input-switch_1_count').val(restoredCount);
          } else if (context.switch_1_count) {
            $('#node-input-switch_1_count').val(context.switch_1_count);
          }

          renderDropdownLabels(context);

          // Watch count field changes
          $('#node-input-switch_1_count').on('change', () => {
            renderDropdownLabels(context);
          });
        }
      }
    }

    $('#node-input-switch_1_type').on('change', renderTypeConfig);
    renderTypeConfig();
  }

  function renderDropdownLabels (context) {
    $('#switch-1-pairs-row').remove();

    const count = parseInt($('#node-input-switch_1_count').val()) || 2;

    // Create labels container
    const labelsContainer = $(`
    <div class="form-row" id="switch-1-pairs-row">
        <label>Options</label>
        <div id="switch-1-pairs-container" style="display:flex;flex-direction:column;gap:4px;"></div>
    </div>
  `);
    $('#switch-1-config-row').after(labelsContainer);

    // Parse saved data from string array
    let savedLabels = [];
    const savedLabel = context.switch_1_label;
    if (savedLabel) {
      try {
        savedLabels = JSON.parse(savedLabel);
      } catch (e) {
        savedLabels = [];
      }
    }

    // Create label inputs
    for (let j = 0; j < count; j++) {
      const value = savedLabels[j] || '';
      const labelHtml = $(`
      <div class="form-row" style="align-items:center;">
        <label for="node-input-switch_1_value_${j}" style="min-width:120px;">Option ${j + 1}</label>
        <input type="text"
               id="node-input-switch_1_value_${j}"
               placeholder="Label"
               style="width:180px;"
               value="${value}" required>
      </div>
    `);
      $('#switch-1-pairs-container').append(labelHtml);
    }
  }

  function updateSwitchConfig () {
    const container = $('#switch-config-container');
    container.empty();
    if ($('select#node-input-device').val() !== 'switch') return
    renderSwitchConfigRow(this);
  }

  function updateBatteryVoltageVisibility () {
    const defaultValues = $('#node-input-default_values').is(':checked');
    const preset = $('#node-input-battery_voltage_preset').val();

    // Show voltage row only when default values is enabled
    $('#battery-voltage-row').toggle(defaultValues);

    // Show custom input only when custom is selected
    $('#node-input-battery_voltage_custom').toggle(preset === 'custom');
    $('#battery-voltage-custom-label').toggle(preset === 'custom');
  }

  function checkSelectedVirtualDevice () {
    [
      'battery', 'generator', 'gps', 'grid', 'motordrive', 'pvinverter',
      'switch', 'tank', 'temperature'
    ].forEach(x => { $('.input-' + x).hide(); });

    const selected = $('select#node-input-device').val();
    $('.input-' + selected).show();

    if (selected === 'battery') {
      $('#node-input-default_values').off('change.battery-voltage').on('change.battery-voltage', updateBatteryVoltageVisibility);
      $('#node-input-battery_voltage_preset').off('change.battery-voltage').on('change.battery-voltage', updateBatteryVoltageVisibility);

      updateBatteryVoltageVisibility();
    }

    if (selected === 'temperature') {
      // Show/hide battery voltage input based on checkbox
      $('#node-input-include-battery').off('change').on('change', function () {
        if ($(this).is(':checked')) {
          $('#battery-voltage-row').show();
        } else {
          $('#battery-voltage-row').hide();
        }
      });

      // Initially set battery voltage visibility
      $('#battery-voltage-row').toggle($('#node-input-include-battery').is(':checked'));
    }

    if (selected === 'generator') {
      checkGeneratorType();
    }

    if (selected === 'gps') {
      $('#node-input-default_values').prop('checked', false).prop('disabled', true);
    } else {
      $('#node-input-default_values').prop('disabled', false);
    }

    if (selected === 'switch') {
      updateSwitchConfig.call(this);
      // Hide the default values checkbox and info box for switches
      $('#node-input-default_values').closest('.form-row').hide();
      $('#default-values-info').hide();
    } else {
      // Show for other device types
      $('#node-input-default_values').closest('.form-row').show();
      $('#default-values-info').show();
    }
  }

  function validateSwitchConfig () {
    const type = $('#node-input-switch_1_type').val();
    const cfg = SWITCH_TYPE_CONFIGS[type];

    if (cfg && cfg.fields.length) {
      for (const field of cfg.fields) {
        const $input = $(`#node-input-switch_1_${field.id}`);
        if ($input.length && !$input.val()) {
          $input[0].setCustomValidity('This field is required');
          $input[0].reportValidity();
          return false
        } else if ($input.length) {
          if (field.id === 'max' && type === '4') {
            const maxVal = parseInt($input.val(), 10);
            if (isNaN(maxVal) || maxVal < 1 || maxVal > 7) {
              $input[0].setCustomValidity('Max steps must be between 1 and 7');
              $input[0].reportValidity();
              return false
            } else {
              $input[0].setCustomValidity('');
            }
          } else {
            $input[0].setCustomValidity('');
          }
        }
      }
    }

    // Special validation for dropdown type (6)
    if (type === '6') {
      const pairCount = parseInt($('#node-input-switch_1_count').val()) || 2;
      for (let j = 0; j < pairCount; j++) {
        const $value = $(`#node-input-switch_1_value_${j}`);
        if ($value.length && !$value.val()) {
          $value[0].setCustomValidity('Label is required');
          $value[0].reportValidity();
          return false
        }
        if ($value.length) $value[0].setCustomValidity('');
      }
    }
    return true
  }

  window.checkGeneratorType = checkGeneratorType;
  window.SWITCH_TYPE_CONFIGS = SWITCH_TYPE_CONFIGS;
  window.renderSwitchConfigRow = renderSwitchConfigRow;
  window.updateSwitchConfig = updateSwitchConfig;
  window.checkSelectedVirtualDevice = checkSelectedVirtualDevice;
  window.validateSwitchConfig = validateSwitchConfig;
  window.updateBatteryVoltageVisibility = updateBatteryVoltageVisibility;

})();
