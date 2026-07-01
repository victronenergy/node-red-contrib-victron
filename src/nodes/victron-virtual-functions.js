/* global $ */

import {
  SWITCH_TYPE_MAP,
  SWITCH_TYPE_NAMES,
  SWITCH_TYPE_BITMASK_NAMES,
  SWITCH_OUTPUT_CONFIG,
  SWITCH_SECOND_OUTPUT_LABEL,
  SWITCH_THIRD_OUTPUT_LABEL,
  STEPPED_DEFAULT_MAX
} from './victron-virtual-constants'
import { initializeTooltips } from './victron-common'
import escape from 'lodash/escape'

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

const createDocTemplate = (paths, outputs) => ({
  text: `
    ${INPUT_DOCS}
    <div>
      ${paths}
    </div>
    <div>
      ${outputs}
    </div>
  `
})

const STATUS_PATH_DOC = '<li><code>/SwitchableOutput/output_1/Status</code> &mdash; Bitmask: 0x00=Off, 0x09=On, 0x01=Powered, 0x02=Tripped, 0x04=Over temperature, 0x08=Output fault, 0x10=Short fault, 0x20=Disabled, 0x40=Bypassed, 0x80=Ext. control.</li>'

const DEFAULT_PATH_ICON = '<i class="fa fa-bolt tooltip-icon" data-tooltip="Shortcut: plain msg.payload sets this path."></i>'

function makeBoltBullets ($container) {
  if (!$container || typeof $container.find !== 'function') return
  $container.find('li').each(function () {
    const $li = $(this)
    const $bolt = $li.find('.fa-bolt')
    if ($bolt.length) {
      $bolt.detach()
      $li.addClass('victron-shortcut-bullet')
      $li.prepend($bolt)
    }
  })
}
const STATE_WITH_STATUS_DOC = '<tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the switch. <tt>msg.status</tt> contains the raw Status value (<tt>msg.status.value</tt>) and decoded flags (see Status path above).'

export const SWITCH_TYPE_DOCS = {
  [SWITCH_TYPE_MAP.MOMENTARY]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/State</code></strong> &mdash; Requested on/off state of channel, separate from dimming. ${DEFAULT_PATH_ICON}</li>${STATUS_PATH_DOC}</ul></div>`,
    `<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; ${STATE_WITH_STATUS_DOC}</li></ol></div>`
  ),
  [SWITCH_TYPE_MAP.TOGGLE]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/State</code></strong> &mdash; Requested on/off state of channel, separate from dimming. ${DEFAULT_PATH_ICON}</li>${STATUS_PATH_DOC}</ul></div>`,
    `<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; ${STATE_WITH_STATUS_DOC}</li></ol></div>`
  ),
  [SWITCH_TYPE_MAP.DIMMABLE]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of channel, separate from dimming.</li><li><strong><code>/SwitchableOutput/output_1/Dimming</code></strong> &mdash; 0 to 100%, read/write. ${DEFAULT_PATH_ICON}</li>${STATUS_PATH_DOC}</ul></div>`,
    `<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; ${STATE_WITH_STATUS_DOC}</li><li><code>Dimming</code> &mdash; <tt>msg.payload</tt> contains the dimming value</li></ol></div>`
  ),
  [SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/Dimming</code></strong> &mdash; holds slider value in °C. ${DEFAULT_PATH_ICON}</li><li><code>/SwitchableOutput/output_1/Measurement</code> &mdash; holds temperature measurement, if available.<br>
      <span style="font-size:0.95em;color:#666;">If present, the actual value will be displayed on the control.</span>
    </li><li><code>/SwitchableOutput/x/Settings/DimmingMin</code> defines slider minimum value. 0 will be used if omitted.</li><li><code>/SwitchableOutput/x/Settings/DimmingMax</code> defines slider maximum value. 100 will be used if omitted.</li><li><code>/SwitchableOutput/x/Settings/StepSize</code> defines stepsize. Stepsize = 1°C if omitted.</li></ul></div>`,
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>Temperature</code> &mdash; <tt>msg.payload</tt> contains the temperature value</li></ol></div>'
  ),
  [SWITCH_TYPE_MAP.STEPPED]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/Dimming</code></strong> &mdash; holds selected option. ${DEFAULT_PATH_ICON}</li><li><code>/SwitchableOutput/output_1/Settings/DimmingMax</code> &mdash; defines the number of options. Mandatory for this type.</li>${STATUS_PATH_DOC}</ul></div>`,
    `<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; ${STATE_WITH_STATUS_DOC}</li><li><code>Value</code> &mdash; <tt>msg.payload</tt> contains the stepped value</li></ol></div>`
  ),
  [SWITCH_TYPE_MAP.DROPDOWN]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/Dimming</code></strong> &mdash; holds selected option. ${DEFAULT_PATH_ICON}</li><li><code>/SwitchableOutput/output_1/Settings/Labels</code> &mdash; defines the labels as a string array: <tt>["Label 1", "Label 2", "Label 3"]</tt>. Mandatory for this type.</li></ul></div>`,
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>Selected</code> &mdash; <tt>msg.payload</tt> contains the index of the selected option (<tt>0</tt> for the first item in the list)</li></ol></div>'
  ),
  [SWITCH_TYPE_MAP.BASIC_SLIDER]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/Dimming</code></strong> &mdash; holds the current slider value. ${DEFAULT_PATH_ICON}</li><li><code>/SwitchableOutput/output_1/Settings/Min</code> &mdash; defines slider minimum value. <tt>0</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/Max</code> &mdash; defines slider maximum value. <tt>100</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/StepSize</code> &mdash; defines stepsize. Stepsize = <tt>1</tt> if omitted.</li></ul></div>`,
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>Value</code> &mdash; <tt>msg.payload</tt> contains the slider value</li></ol></div>'
  ),
  [SWITCH_TYPE_MAP.NUMERIC_INPUT]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/Dimming</code></strong> &mdash; holds the current numeric value. ${DEFAULT_PATH_ICON}</li><li><code>/SwitchableOutput/output_1/Settings/Min</code> &mdash; defines the minimum value. <tt>0</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/Max</code> &mdash; defines the maximum value. <tt>100</tt> will be used if omitted.</li><li><code>/SwitchableOutput/output_1/Settings/StepSize</code> &mdash; defines stepsize. Stepsize = <tt>1</tt> if omitted.</li>${STATUS_PATH_DOC}</ul></div>`,
    `<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; ${STATE_WITH_STATUS_DOC}</li><li><code>Value</code> &mdash; <tt>msg.payload</tt> contains the numeric value</li></ol></div>`
  ),
  [SWITCH_TYPE_MAP.THREE_STATE]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/State</code></strong> &mdash; holds the current state (0=Off, 1=On). ${DEFAULT_PATH_ICON}</li><li><code>/SwitchableOutput/output_1/Auto</code> &mdash; holds the auto mode (0=Manual, 1=Auto). When in auto mode, the GX device controls the state.</li>${STATUS_PATH_DOC}</ul></div>`,
    `<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; ${STATE_WITH_STATUS_DOC}</li><li><code>Auto mode</code> &mdash; <tt>msg.payload</tt> contains the auto mode (0=Manual, 1=Auto)</li></ol></div>`
  ),
  [SWITCH_TYPE_MAP.BILGE_PUMP]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul><li><strong><code>/SwitchableOutput/output_1/State</code></strong> &mdash; Pump state: 0=Auto, 1=On. ${DEFAULT_PATH_ICON}</li>${STATUS_PATH_DOC}</ul></div>`,
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains the pump state (0=Auto, 1=On). <tt>msg.status</tt> contains the raw Status value (<tt>msg.status.value</tt>) and decoded flags (see Status path above).</li></ol></div>'
  ),
  [SWITCH_TYPE_MAP.RGB_COLOR_WHEEL]: createDocTemplate(
    `<div><strong>Most relevant paths:</strong><ul>
      <li><code>/SwitchableOutput/output_1/State</code> &mdash; Requested on/off state of the light.</li>
      <li><code>/SwitchableOutput/output_1/LightControls</code> &mdash; Array of 5 integers: <tt>[Hue (0-360°), Saturation (0-100%), Brightness (0-100%), White (0-100%), ColorTemperature (0-6500K)]</tt>.
        <br><span style="font-size:0.95em;color:#666;">Array elements used depend on selected control types:<br>
        • RGB color wheel: Hue, Saturation, Brightness<br>
        • CCT wheel: Brightness, ColorTemperature<br>
        • RGB + white dimmer: Hue, Saturation, Brightness, White</span>
      </li>
    </ul></div>`,
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li><li><code>State</code> &mdash; <tt>msg.payload</tt> contains a <tt>0</tt> or <tt>1</tt> representing the on/off state of the light</li><li><code>LightControls</code> &mdash; <tt>msg.payload</tt> contains the 5-element array with color and brightness values. Additional convenience fields: <tt>msg.rgb</tt> (hex string, e.g. #FF0000), <tt>msg.hsb</tt> (object with hue, saturation, brightness), <tt>msg.white</tt> (0-100%), <tt>msg.colorTemperature</tt> (Kelvin)</li></ol></div>'
  )
}

// Device type documentation
export const DEVICE_TYPE_DOCS = {
  acload: {
    label: 'AC Load',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Ac/{line}/Power</code> &mdash; Power per phase in watts, where <code>{line}</code> is <code>L1</code>, <code>L2</code>, or <code>L3</code>.</li>
          <li><code>/Ac/{line}/Voltage</code> &mdash; Voltage per phase in volts.</li>
          <li><code>/Ac/{line}/Current</code> &mdash; Current per phase in amperes.</li>
          <li><code>/Ac/{line}/Energy/Forward</code> &mdash; Energy consumed per phase in kWh.</li>
          <li><code>/Ac/Frequency</code> &mdash; AC frequency in Hz.</li>
          <li><code>/Ac/PowerFactor</code> &mdash; Overall power factor.</li>
          <li><code>/Ac/{line}/PowerFactor</code> &mdash; Power factor per phase.</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  battery: {
    label: 'Battery',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Dc/0/Voltage</code> &mdash; Battery voltage in volts.</li>
          <li><code>/Dc/0/Current</code> &mdash; Battery current in amperes. Positive values indicate charging, negative values indicate discharging.</li>
          <li><code>/Dc/0/Power</code> &mdash; Battery power in watts.</li>
          <li><code>/Soc</code> &mdash; State of charge as a percentage (0-100%).</li>
          <li><code>/Capacity</code> &mdash; Battery capacity in Ah.</li>
          <li><code>/ConsumedAmphours</code> &mdash; Consumed amp-hours in Ah.</li>
          <li><code>/TimeToGo</code> &mdash; Estimated time remaining in seconds.</li>
          <li><code>/Dc/0/Temperature</code> &mdash; Battery temperature in °C (if temperature sensor is enabled).</li>
        </ul>
        <p><strong>Note:</strong> The battery device includes numerous alarm paths for monitoring conditions such as high/low voltage, temperature, cell imbalance, and more. Use the <strong>Custom Control</strong> node to discover all available paths on your deployed device, or see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a> for the complete list.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  dcload: {
    label: 'DC Load',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Dc/0/Voltage</code> &mdash; DC load voltage in volts.</li>
          <li><code>/Dc/0/Current</code> &mdash; DC load current in amperes.</li>
          <li><code>/Dc/0/Power</code> &mdash; DC load power in watts.</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  ev: {
    label: 'Electric Vehicle',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Soc</code> &mdash; State of charge as a percentage (0-100%).</li>
          <li><code>/TargetSoc</code> &mdash; Target state of charge as a percentage (0-100%).</li>
          <li><code>/ChargingState</code> &mdash; Charging state: <code>0</code> = Not charging, <code>1</code> = Low power mode, <code>3</code> = Charging, <code>256</code> = Discharging, <code>259</code> = Scheduled charging. Also supported: <code>244</code> = Sustain, <code>245</code> = Wake up, <code>250</code> = Blocked, <code>255</code> = Unavailable.</li>
          <li><code>/Ac/Power</code> &mdash; AC power in watts. Positive = charging, negative = discharging (V2G/V2H).</li>
          <li><code>/Odometer</code> &mdash; Odometer reading in km.</li>
          <li><code>/RangeToGo</code> &mdash; Estimated driving range in km.</li>
          <li><code>/Position/Latitude</code> &mdash; Vehicle latitude in decimal degrees.</li>
          <li><code>/Position/Longitude</code> &mdash; Vehicle longitude in decimal degrees.</li>
          <li><code>/AtSite</code> &mdash; Whether the EV is at the site: <code>0</code> = No, <code>1</code> = Yes.</li>
          <li><code>/LastEvContact</code> &mdash; Unix timestamp of the last contact with the EV.</li>
          <li><code>/Alarms/StarterBatteryLow</code> &mdash; Starter battery low alarm: <code>0</code> = No alarm, <code>1</code> = Alarm.</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  'e-drive': {
    label: 'E-drive',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Dc/0/Voltage</code> &mdash; Controller DC voltage in volts.</li>
          <li><code>/Dc/0/Current</code> &mdash; Controller DC current in amperes.</li>
          <li><code>/Dc/0/Power</code> &mdash; Controller DC power in watts.</li>
          <li><code>/Motor/RPM</code> &mdash; Motor speed in RPM (if enabled).</li>
          <li><code>/Motor/Direction</code> &mdash; Motor direction: <code>0</code> = Neutral, <code>1</code> = Reverse, <code>2</code> = Forward (if enabled).</li>
          <li><code>/Motor/Temperature</code> &mdash; Motor temperature in °C (if enabled).</li>
          <li><code>/Controller/Temperature</code> &mdash; Controller temperature in °C (if enabled).</li>
          <li><code>/Coolant/Temperature</code> &mdash; Coolant temperature in °C (if enabled).</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  gps: {
    label: 'GPS',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Position/Latitude</code> &mdash; Latitude in decimal degrees.</li>
          <li><code>/Position/Longitude</code> &mdash; Longitude in decimal degrees.</li>
          <li><code>/Altitude</code> &mdash; Altitude in meters.</li>
          <li><code>/Speed</code> &mdash; Speed in m/s.</li>
          <li><code>/Course</code> &mdash; Course/heading in degrees.</li>
          <li><code>/Fix</code> &mdash; GPS fix status.</li>
          <li><code>/NrOfSatellites</code> &mdash; Number of satellites in view.</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  generator: {
    label: 'Generator',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <p><em>AC Generator (genset):</em></p>
        <ul>
          <li><code>/Ac/{phase}/Power</code> &mdash; Power per phase in watts, where <code>{phase}</code> is <code>L1</code>, <code>L2</code>, or <code>L3</code>.</li>
          <li><code>/Ac/{phase}/Voltage</code> &mdash; Voltage per phase in volts.</li>
          <li><code>/Ac/{phase}/Current</code> &mdash; Current per phase in amperes.</li>
          <li><code>/Ac/Frequency</code> &mdash; AC frequency in Hz.</li>
          <li><code>/Engine/OperatingHours</code> &mdash; Engine operating hours (if enabled).</li>
          <li><code>/StarterVoltage</code> &mdash; Starter battery voltage in volts (if enabled).</li>
        </ul>
        <p><em>DC Generator (dcgenset):</em></p>
        <ul>
          <li><code>/Dc/0/Voltage</code> &mdash; DC output voltage in volts.</li>
          <li><code>/Dc/0/Current</code> &mdash; DC output current in amperes.</li>
          <li><code>/Dc/0/Power</code> &mdash; DC output power in watts.</li>
          <li><code>/History/EnergyOut</code> &mdash; Total energy output in kWh (if enabled).</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
    <div>
      <div><strong>Generator Start/Stop:</strong>
        <p>When a virtual generator is deployed, Venus OS automatically creates a <em>Generator Start/Stop</em> service (<code>com.victronenergy.generator</code>) for it. This service controls and monitors the generator from the Venus OS side &mdash; including auto-start conditions, manual start, and runtime tracking.</p>
        <p>Use the <strong>input-generator</strong> node to read from that service (e.g. <code>/State</code>, <code>/Runtime</code>, <code>/RunningByConditionCode</code>) and the <strong>output-generator</strong> node to control it (e.g. <code>/ManualStart</code>, <code>/AutoStartEnabled</code>).</p>
        <p>See the <a href="https://github.com/victronenergy/venus/wiki/dbus#generator-startstop" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS Generator Start/Stop documentation</a> for the full path list.</p>
      </div>
    </div>
  `,
    img: null
  },
  grid: {
    label: 'Grid meter',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Ac/Power</code> &mdash; Total AC power in watts. Positive values indicate power consumption from the grid, negative values indicate power fed back to the grid.</li>
          <li><code>/Ac/{line}/Power</code> &mdash; Power per phase in watts, where <code>{line}</code> is <code>L1</code>, <code>L2</code>, or <code>L3</code>.</li>
          <li><code>/Ac/{line}/Voltage</code> &mdash; Voltage per phase in volts.</li>
          <li><code>/Ac/{line}/Current</code> &mdash; Current per phase in amperes.</li>
          <li><code>/Ac/Energy/Forward</code> &mdash; Total energy purchased from the grid in kWh.</li>
          <li><code>/Ac/Energy/Reverse</code> &mdash; Total energy sold back to the grid in kWh.</li>
          <li><code>/Ac/{line}/Energy/Forward</code> &mdash; Energy purchased per phase in kWh.</li>
          <li><code>/Ac/{line}/Energy/Reverse</code> &mdash; Energy sold per phase in kWh.</li>
          <li><code>/Ac/Frequency</code> &mdash; Grid frequency in Hz.</li>
          <li><code>/Ac/PowerFactor</code> &mdash; Overall power factor.</li>
          <li><code>/Ac/{line}/PowerFactor</code> &mdash; Power factor per phase.</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  energymeter: {
    label: 'Energy meter',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Ac/Power</code> &mdash; Total AC power in watts.</li>
          <li><code>/Ac/{line}/Power</code> &mdash; Power per phase in watts, where <code>{line}</code> is <code>L1</code>, <code>L2</code>, or <code>L3</code>.</li>
          <li><code>/Ac/{line}/Voltage</code> &mdash; Voltage per phase in volts.</li>
          <li><code>/Ac/{line}/Current</code> &mdash; Current per phase in amperes.</li>
          <li><code>/Ac/Energy/Forward</code> &mdash; Total energy consumed in kWh.</li>
          <li><code>/Ac/Energy/Reverse</code> &mdash; Total energy fed back in kWh.</li>
          <li><code>/Ac/{line}/Energy/Forward</code> &mdash; Energy consumed per phase in kWh.</li>
          <li><code>/Ac/{line}/Energy/Reverse</code> &mdash; Energy fed back per phase in kWh.</li>
          <li><code>/Ac/{line}/PowerFactor</code> &mdash; Power factor per phase.</li>
          <li><code>/DeviceType</code> &mdash; Device type identifier.</li>
          <li><code>/ErrorCode</code> &mdash; Error code (0 = no error).</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  meteo: {
    label: 'Meteo',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Irradiance</code> &mdash; Solar irradiance in W/m².</li>
          <li><code>/WindSpeed</code> &mdash; Wind speed in m/s.</li>
          <li><code>/WindDirection</code> &mdash; Wind direction in degrees.</li>
          <li><code>/ExternalTemperature</code> &mdash; External temperature in °C.</li>
          <li><code>/CellTemperature</code> &mdash; Sensor cell temperature in °C.</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  pvinverter: {
    label: 'PV Inverter',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Ac/Power</code> &mdash; Total AC power output in watts.</li>
          <li><code>/Ac/{line}/Power</code> &mdash; Power per phase in watts, where <code>{line}</code> is <code>L1</code>, <code>L2</code>, or <code>L3</code>.</li>
          <li><code>/Ac/{line}/Voltage</code> &mdash; Voltage per phase in volts.</li>
          <li><code>/Ac/{line}/Current</code> &mdash; Current per phase in amperes.</li>
          <li><code>/Ac/Energy/Forward</code> &mdash; Total energy produced in kWh.</li>
          <li><code>/Ac/{line}/Energy/Forward</code> &mdash; Energy produced per phase in kWh.</li>
          <li><code>/Position</code> &mdash; Position: <code>0</code> = AC input 1, <code>1</code> = AC output, <code>2</code> = AC input 2.</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  tank: {
    label: 'Tank sensor',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Level</code> &mdash; Tank level as a percentage (0-100%).</li>
          <li><code>/Remaining</code> &mdash; Remaining fluid volume in m³.</li>
          <li><code>/Capacity</code> &mdash; Tank capacity in m³.</li>
          <li><code>/FluidType</code> &mdash; Fluid type: <code>0</code> = Fuel, <code>1</code> = Fresh water, <code>2</code> = Waste water, <code>3</code> = Live well, <code>4</code> = Oil, <code>5</code> = Black water, <code>6</code> = Gasoline, <code>7</code> = Diesel, <code>8</code> = LPG, <code>9</code> = LNG, <code>10</code> = Hydraulic oil, <code>11</code> = Raw water.</li>
          <li><code>/Temperature</code> &mdash; Temperature in °C (if enabled).</li>
          <li><code>/BatteryVoltage</code> &mdash; Sensor battery voltage in volts (if enabled).</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  temperature: {
    label: 'Temperature sensor',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Temperature</code> &mdash; Temperature in °C.</li>
          <li><code>/TemperatureType</code> &mdash; Sensor type: <code>0</code> = Battery, <code>1</code> = Fridge, <code>2</code> = Generic, <code>3</code> = Room, <code>4</code> = Outdoor, <code>5</code> = Water heater, <code>6</code> = Freezer.</li>
          <li><code>/Humidity</code> &mdash; Humidity as a percentage (if enabled).</li>
          <li><code>/Pressure</code> &mdash; Atmospheric pressure in kPa (if enabled).</li>
          <li><code>/BatteryVoltage</code> &mdash; Sensor battery voltage in volts (if enabled).</li>
        </ul>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  },
  pulsemeter: {
    label: 'Pulse meter',
    text: `
    ${INPUT_DOCS}
    <div>
      <div><strong>Most relevant paths:</strong>
        <ul>
          <li><code>/Count</code> &mdash; Cumulative pulse count (integer). The raw counter value from the pulse source.</li>
          <li><code>/Aggregate</code> &mdash; Measured aggregate value in m&sup3; (float). Set this directly in dumb mode, or let it be computed automatically from Count when auto-compute is enabled.</li>
        </ul>
        <p>When <em>Auto-compute Aggregate</em> is enabled, Aggregate is derived as <code>Count &times; multiplier</code> whenever Count changes. For example, with multiplier <code>0.001</code> each pulse represents 1 litre (1000 pulses = 1 m&sup3;).</p>
        <p>For more information on available paths, see the <a href="https://github.com/victronenergy/venus/wiki/dbus" target="_blank" rel="noopener noreferrer" class="blue-link">Venus OS dbus specification</a>.</p>
      </div>
    </div>
    <div>
      <div><strong>Output:</strong>
        <ol>
          <li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li>
          <li><code>Aggregate</code> &mdash; Emits <tt>msg.payload</tt> with the current Aggregate value whenever it changes</li>
        </ol>
      </div>
    </div>
  `,
    img: null
  }
}

export function renderShowInUICheckboxes (containerId, savedValue, targetInputId) {
  const localId = `${containerId}-local`
  const remoteId = `${containerId}-remote`

  const savedInt = parseInt(savedValue ?? 1, 10)
  const localChecked = !!(savedInt & 1) || !!(savedInt & 2)
  const remoteChecked = !!(savedInt & 1) || !!(savedInt & 4)

  const container = $(`#${containerId}`)
  container.empty()
  container.append(`
    <label style="font-weight:bold;"><i class="fa fa-eye"></i> Show in UI</label>
    <div class="form-row victron-checkbox">
      <input type="checkbox" id="${localId}">
      <label for="${localId}">Local UI
        <i class="fa fa-info-circle tooltip-icon" data-tooltip="GUI running natively on GX device, MFD and WASM over local LAN"></i>
      </label>
    </div>
    <div class="form-row victron-checkbox">
      <input type="checkbox" id="${remoteId}">
      <label for="${remoteId}">Remote UI
        <i class="fa fa-info-circle tooltip-icon" data-tooltip="VRM remote console and VRM switch pane"></i>
      </label>
    </div>
  `)

  $(`#${localId}`).prop('checked', localChecked)
  $(`#${remoteId}`).prop('checked', remoteChecked)

  if (targetInputId) {
    const updateTarget = () => {
      $(`#${targetInputId}`).val(getShowUIValue(containerId))
    }
    $(`#${localId}`).on('change', updateTarget)
    $(`#${remoteId}`).on('change', updateTarget)
    updateTarget()
  }
}

export function getShowUIValue (containerId) {
  const local = $(`#${containerId}-local`).is(':checked')
  const remote = $(`#${containerId}-remote`).is(':checked')
  if (local && remote) return 1
  if (local) return 2
  if (remote) return 4
  return 0
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

  let isInitialRender = true

  function renderTypeConfig () {
    $('#switch-1-config-row').remove()
    $('#switch-1-pairs-row').remove()
    $('#switch-docs-container').empty()

    const type = $('#node-input-switch_1_type').val()
    const cfg = SWITCH_TYPE_CONFIGS[type]
    const doc = SWITCH_TYPE_DOCS[type]

    if (cfg && cfg.fields.length) {
      // Render each field as a separate row
      const fieldsHtml = cfg.fields.map(field => {
        const stepAttr = field.id === 'step' || field.id === 'stepsize' ? 'step="any"' : ''
        const minAttr = field.min !== undefined ? `min="${field.min}"` : ''
        const maxAttr = field.max !== undefined ? `max="${field.max}"` : ''
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
                  ${minAttr} ${maxAttr} ${stepAttr} required>
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

      // Restore saved values; on type change, skip type-specific fields.
      // Also restore if the rendered type matches the saved type (handles spurious change events
      // triggered by Node-RED's post-oneditprepare field population).
      cfg.fields.forEach(field => {
        const isCommonField = COMMON_SWITCH_FIELDS.some(f => f.id === field.id)
        const isTypeUnchanged = Number(type) === Number(context.switch_1_type)
        let val = (isInitialRender || isCommonField || isTypeUnchanged) ? context[`switch_1_${field.id}`] : undefined
        if (!val && field.id === 'max' && Number(type) === SWITCH_TYPE_MAP.STEPPED) {
          val = STEPPED_DEFAULT_MAX
        }
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
    }

    if (doc) {
      const docRow = $(`
        <div class="form-row">
          <div id="switch-1-doc-row" class="victron-doc-box">
            <label>${cfg.label} usage
              <i class="fa fa-info-circle tooltip-icon" data-tooltip="Approximate preview - actual appearance on the GX device may differ."></i>
            </label>
            <div id="switch-live-preview" class="indicator-preview-card"></div>
            <div class="victron-doc-text">${doc.text}</div>
          </div>
        </div>
      `)
      // Append to the dedicated switch docs container (after default values)
      $('#switch-docs-container').append(docRow)
    }

    // Wire live preview - re-attach each time since the config row is rebuilt on type change
    $('#node-input-switch_1_customname, #node-input-switch_1_group').on('input', updateSwitchLivePreview)
    if (Number(type) === SWITCH_TYPE_MAP.STEPPED) {
      $('#node-input-switch_1_max').on('input', updateSwitchLivePreview)
    }
    if (Number(type) === SWITCH_TYPE_MAP.BASIC_SLIDER || Number(type) === SWITCH_TYPE_MAP.NUMERIC_INPUT) {
      $('#node-input-switch_1_unit').on('input', updateSwitchLivePreview)
    }
    if (Number(type) === SWITCH_TYPE_MAP.DROPDOWN) {
      $('#node-input-switch_1_value_0').on('input', updateSwitchLivePreview)
    }
    if (Number(type) === SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT) {
      $('#node-input-switch_1_min, #node-input-switch_1_max').on('input', updateSwitchLivePreview)
      // Add checkbox before updateSwitchLivePreview so it exists in DOM when the preview reads it
      const measurementToggle = $(`
        <div class="form-row victron-checkbox" id="switch-1-measurement-toggle-row">
          <input type="checkbox" id="node-input-switch_1_include_measurement">
          <label for="node-input-switch_1_include_measurement">Include Measurement path</label>
        </div>
      `)
      $('#switch-1-config-row').append(measurementToggle)
      if (context.switch_1_include_measurement) {
        $('#node-input-switch_1_include_measurement').prop('checked', true)
      }
      $('#node-input-switch_1_include_measurement').on('change', updateSwitchLivePreview)
    }
    updateSwitchLivePreview()

    if (Number(type) === SWITCH_TYPE_MAP.THREE_STATE) {
      const passthroughRow = $(`
        <div class="form-row" id="switch-1-passthrough-row">
          <label for="node-input-switch_1_passthrough_mode">
            Apply input
            <i class="fa fa-info-circle tooltip-icon" data-tooltip="Controls when incoming values are written to D-Bus. Use 'Auto only' to block automations when the switch is in manual mode."></i>
          </label>
          <select id="node-input-switch_1_passthrough_mode">
            <option value="always">Always</option>
            <option value="auto_only">Auto only</option>
          </select>
        </div>
      `)
      $('#switch-1-config-row').append(passthroughRow)

      const savedMode = context.switch_1_passthrough_mode || 'auto_only'
      $('#node-input-switch_1_passthrough_mode').val(savedMode)
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

    makeBoltBullets($('#switch-docs-container'))
    initializeTooltips()
    isInitialRender = false
  }

  $('#node-input-switch_1_type').on('change', renderTypeConfig)
  renderTypeConfig()

  // Show in UI section (outside renderTypeConfig so it persists across type changes)
  $('#switch-config-container').append('<div id="switch-show-ui" style="margin-top:10px;"></div>')
  renderShowInUICheckboxes('switch-show-ui', context.switch_1_show_ui_input)
}

function renderDropdownLabels (context) {
  $('#switch-1-pairs-row').remove()

  const count = parseInt($('#node-input-switch_1_count').val()) || 2

  // Create labels container
  const labelsContainer = $(`
    <div class="form-row" id="switch-1-pairs-row">
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

export function fetchEvChargers (baseUrl) {
  const url = (baseUrl || '') + '/victron/cache'
  return fetch(url)
    .then(response => response.json())
    .then(data => {
      const result = []
      for (const service in data) {
        if (service.indexOf('com.victronenergy.evcharger') === 0) {
          const paths = data[service]
          const deviceInstance = paths['/DeviceInstance'] != null
            ? paths['/DeviceInstance']
            : parseInt(service.split('/')[1], 10)
          const name = paths['/CustomName'] || 'EV Charger'
          if (deviceInstance != null && !isNaN(deviceInstance)) {
            result.push({ deviceInstance, name })
          }
        }
      }
      return result
    })
}

export function fetchSwitchNodeNameAndGroupFromCache (id) {
  if (!id) {
    return Promise.reject(new Error('id is required'))
  }

  return fetch(`/victron/cache?filter_by_serial=${id}`)
    .then(response => response.json())
    .then(data => {
      for (const key in data) {
        if (key.match(/^com.victronenergy\./) && data[key]['/Serial'] === id) {
          const name = data[key]['/SwitchableOutput/output_1/Settings/CustomName']
          const group = data[key]['/SwitchableOutput/output_1/Settings/Group']
          return { name, group }
        }
      }
      // No matching entry found
      return {}
    })
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
    'acload', 'battery', 'ev', 'generator', 'gps', 'grid', 'e-drive',
    'pvinverter', 'switch', 'tank', 'temperature', 'energymeter', 'pulsemeter'
  ].forEach(x => { $('.input-' + x).hide() })

  const selected = $('select#node-input-device').val()
  $('.input-' + selected).show()

  if (selected === 'acload') {
    function updateS2SectionVisibility () {
      const s2enabled = $('#node-input-enable_s2support').is(':checked')
      $('.input-acload-s2').toggle(s2enabled)
    }
    $('#node-input-enable_s2support').off('change.s2support').on('change.s2support', function () {
      context.enable_s2support = $(this).is(':checked')
      updateOutputs(context)
      updateS2SectionVisibility()
    })
    updateS2SectionVisibility()
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

  if (selected === 'pulsemeter') {
    $('#node-input-auto_aggregate').off('change').on('change', function () {
      $('#pulsemeter-multiplier-row').toggle($(this).is(':checked'))
    })
    $('#pulsemeter-multiplier-row').toggle($('#node-input-auto_aggregate').is(':checked'))
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

    // Show device-specific documentation if available
    const doc = DEVICE_TYPE_DOCS[selected]
    if (doc) {
      const docRow = $(`
        <div class="form-row">
          <div id="device-doc-row" class="victron-doc-box">
            <label>${doc.label} usage</label>
            <div class="victron-doc-text">${doc.text}</div>
          </div>
        </div>
      `)
      $('#switch-docs-container').append(docRow)
    }
  }
}

export const INDICATOR_TYPE_DOCS = {
  0: createDocTemplate(
    '<div><strong>Most relevant paths:</strong><ul>' +
    `<li><strong><code>/GenericInput/0/Value</code></strong> &mdash; Current discrete state (integer index, e.g. 0, 1, 2, ...) ${DEFAULT_PATH_ICON}</li>` +
    '<li><code>/GenericInput/0/Status</code> &mdash; Indicator status: 0=OK, 1=Fault, 2=Battery low</li>' +
    '<li><code>/GenericInput/0/Settings/Labels</code> &mdash; Array of label strings, one per discrete value. ' +
    'Custom strings (e.g. <tt>"eco"</tt>) and reserved keywords (e.g. <tt>"/on"</tt>) can be mixed freely. ' +
    'Reserved keywords: <tt>/off</tt>, <tt>/on</tt>, <tt>/open</tt>, <tt>/closed</tt>, <tt>/ok</tt>, <tt>/alarm</tt>, ' +
    '<tt>/stopped</tt>, <tt>/running</tt>, <tt>/low</tt>, <tt>/high</tt></li>' +
    '</ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li></ol></div>'
  ),
  1: createDocTemplate(
    '<div><strong>Most relevant paths:</strong><ul>' +
    `<li><strong><code>/GenericInput/0/Value</code></strong> &mdash; Numeric indicator reading ${DEFAULT_PATH_ICON}</li>` +
    '<li><code>/GenericInput/0/Status</code> &mdash; Indicator status: 0=OK, 1=Fault, 2=Battery low</li>' +
    '<li><code>/GenericInput/0/Settings/Unit</code> &mdash; Display unit, e.g. <tt>W</tt>, <tt>kWh</tt>. ' +
    'Use <tt>/Temperature</tt>, <tt>/Speed</tt> or <tt>/Volume</tt> to follow GX system-wide unit settings</li>' +
    '</ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li></ol></div>'
  ),
  2: createDocTemplate(
    '<div><strong>Most relevant paths:</strong><ul>' +
    `<li><strong><code>/GenericInput/0/Value</code></strong> &mdash; Numeric indicator reading ${DEFAULT_PATH_ICON}</li>` +
    '<li><code>/GenericInput/0/Status</code> &mdash; Indicator status: 0=OK, 1=Fault, 2=Battery low</li>' +
    '<li><code>/GenericInput/0/Settings/RangeMin</code> &mdash; Minimum value for the range indicator</li>' +
    '<li><code>/GenericInput/0/Settings/RangeMax</code> &mdash; Maximum value for the range indicator</li>' +
    '</ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li></ol></div>'
  ),
  3: createDocTemplate(
    '<div><strong>Most relevant paths:</strong><ul>' +
    `<li><strong><code>/GenericInput/0/Value</code></strong> &mdash; Temperature value in the unit selected in GX system settings ${DEFAULT_PATH_ICON}</li>` +
    '<li><code>/GenericInput/0/Status</code> &mdash; Indicator status: 0=OK, 1=Fault, 2=Battery low</li>' +
    '<li><code>/GenericInput/0/Settings/RangeMin</code> &mdash; Minimum value for the range indicator</li>' +
    '<li><code>/GenericInput/0/Settings/RangeMax</code> &mdash; Maximum value for the range indicator</li>' +
    '</ul></div>',
    '<div><strong>Outputs:</strong><ol><li><code>Passthrough</code> &mdash; Outputs the original <tt>msg.payload</tt> without modification</li></ol></div>'
  )
}

export const INDICATOR_TYPE_LABELS = {
  0: 'Discrete',
  1: 'Value',
  2: 'Value with range',
  3: 'Temperature'
}

export const INDICATOR_TYPE = {
  DISCRETE: 0,
  VALUE: 1,
  VALUE_WITH_RANGE: 2,
  TEMPERATURE: 3
}

function isTypeRange (type) {
  return type === INDICATOR_TYPE.VALUE_WITH_RANGE || type === INDICATOR_TYPE.TEMPERATURE
}

export function renderIndicatorDocBox (type) {
  $('#indicator-docs-container').empty()
  const typeKey = parseInt(type, 10)
  const doc = INDICATOR_TYPE_DOCS[typeKey]
  const label = INDICATOR_TYPE_LABELS[typeKey] || 'Indicator'
  if (doc) {
    const docRow = $(`
      <div class="form-row">
        <div id="indicator-doc-row" class="victron-doc-box">
          <label>${label} usage
            <i class="fa fa-info-circle tooltip-icon" data-tooltip="Approximate preview - actual appearance on the GX device may differ depending on system unit settings."></i>
          </label>
          <div id="indicator-live-preview" class="indicator-preview-card"></div>
          <div class="victron-doc-text">${doc.text}</div>
        </div>
      </div>
    `)
    $('#indicator-docs-container').append(docRow)
    makeBoltBullets($('#indicator-docs-container'))
    initializeTooltips()
  }
}

const SVG_FONT = 'system-ui, -apple-system, sans-serif'
const SVG_COLOR_TEXT = '#1D1D1B'
const SVG_COLOR_TEXT_DIM = '#64635F'
const SVG_COLOR_CARD_BG = '#F0EFEB'
const SVG_COLOR_SEPARATOR = '#E6E5E1'
const SVG_COLOR_CTRL_BG = '#BBCEE0'
const SVG_COLOR_ACTIVE = '#387DC5'
const SVG_ACTIVE_FILL_OPACITY = 0.7
const SVG_COLOR_TEMP_COLD = '#5991CE'
const SVG_COLOR_TEMP_MID = '#7E6EB7'
const SVG_COLOR_TEMP_HOT = '#D66A67'
const RESERVED_UNIT_LABELS = { '/Temperature': 'Temperature', '/Speed': 'Speed', '/Volume': 'Volume' }
const RESERVED_UNITS = { '/Temperature': '°C', '/Speed': 'km/h', '/Volume': 'L' }

function buildSimpleCardSvg (title, cardLabel, valueText) {
  return `<svg width="368" height="88" viewBox="0 0 368 88" fill="none" xmlns="http://www.w3.org/2000/svg">
<text x="16" y="24" font-family="${SVG_FONT}" font-size="12" fill="${SVG_COLOR_TEXT}">${escape(title)}</text>
<line x1="8" y1="87.5" x2="360" y2="87.5" stroke="${SVG_COLOR_SEPARATOR}"/>
<rect x="16" y="34" width="336" height="40" rx="6" fill="${SVG_COLOR_CARD_BG}"/>
<text x="36" y="59" font-family="${SVG_FONT}" font-size="14" fill="${SVG_COLOR_TEXT_DIM}">${escape(cardLabel)}</text>
<text x="340" y="59" text-anchor="end" font-family="${SVG_FONT}" font-size="14" fill="${SVG_COLOR_TEXT}">${escape(valueText)}</text>
</svg>`
}

function buildRangeCardSvg (title, valueText) {
  const barWidth = 250
  const barFill = Math.round(barWidth * 0.4)
  return `<svg width="368" height="62" viewBox="0 0 368 62" fill="none" xmlns="http://www.w3.org/2000/svg">
<text x="16" y="20" font-family="${SVG_FONT}" font-size="12" fill="${SVG_COLOR_TEXT}">${escape(title)}</text>
<line x1="8" y1="61.5" x2="360" y2="61.5" stroke="${SVG_COLOR_SEPARATOR}"/>
<rect x="16" y="28" width="336" height="24" rx="6" fill="${SVG_COLOR_CARD_BG}"/>
<defs><linearGradient id="bar-grad" x1="${24 + barWidth}" y1="40" x2="24" y2="40" gradientUnits="userSpaceOnUse">
<stop stop-color="${SVG_COLOR_TEMP_HOT}"/><stop offset="0.47" stop-color="${SVG_COLOR_TEMP_MID}"/><stop offset="1" stop-color="${SVG_COLOR_TEMP_COLD}"/>
</linearGradient></defs>
<rect x="24" y="36" width="${barWidth}" height="8" rx="4" fill="${SVG_COLOR_CTRL_BG}"/>
<rect x="24" y="36" width="${barFill}" height="8" rx="4" fill="url(#bar-grad)"/>
<text x="348" y="44" text-anchor="end" font-family="${SVG_FONT}" font-size="14" fill="${SVG_COLOR_TEXT}">${escape(valueText)}</text>
</svg>`
}

export function updateIndicatorLivePreview () {
  const $preview = $('#indicator-live-preview')
  if (!$preview.length) return

  const type = parseInt($('#node-input-indicator_type').val(), 10)
  const isRange = isTypeRange(type)
  const isTemperature = type === INDICATOR_TYPE.TEMPERATURE

  function placeholderOf (selector) {
    return ($('#' + selector).attr('placeholder') || '').replace(/^e\.g\.\s*/i, '').split(',')[0].trim()
  }

  const customname = $('#node-input-customname').val() || ''
  const title = customname || placeholderOf('node-input-customname') || 'State'

  let cardLabel
  let valueText

  if (type === INDICATOR_TYPE.DISCRETE) {
    const rawLabels = $('#node-input-labels').val() || ''
    cardLabel = $('#node-input-primary_label').val() || placeholderOf('node-input-primary_label') || 'State'
    valueText = rawLabels.split(',')[0].trim().replace(/^\//, '') || 'Off'
  } else if (isRange) {
    cardLabel = title
    const rawUnit = $('#node-input-unit').val() || ''
    const decimalsRaw = $('#node-input-decimals').val()
    const decimals = decimalsRaw !== '' && !isNaN(decimalsRaw) ? parseInt(decimalsRaw, 10) : 1
    const unit = isTemperature ? '°C' : (RESERVED_UNITS[rawUnit] || rawUnit)
    valueText = (21.5).toFixed(decimals) + (unit ? ' ' + unit : '')
  } else {
    const rawUnit = $('#node-input-unit').val() || ''
    cardLabel = RESERVED_UNIT_LABELS[rawUnit] || $('#node-input-primary_label').val() || placeholderOf('node-input-primary_label') || 'State'
    const decimalsRaw = $('#node-input-decimals').val()
    const decimals = decimalsRaw !== '' && !isNaN(decimalsRaw) ? parseInt(decimalsRaw, 10) : 1
    const unit = RESERVED_UNITS[rawUnit] || rawUnit
    valueText = (21.5).toFixed(decimals) + (unit ? ' ' + unit : '')
  }

  if (isRange) {
    $preview.html(buildRangeCardSvg(title, valueText))
  } else {
    $preview.html(buildSimpleCardSvg(title, cardLabel, valueText))
  }
}

// SVG card layout constants for switch live preview
const SWITCH_CARD_WIDTH = 320
const SWITCH_CARD_HEIGHT = 96
const SWITCH_CARD_NAME_Y = 38
const SWITCH_CTL_X = 8
const SWITCH_CTL_Y = 48
const SWITCH_CTL_W = 304 // SWITCH_CARD_WIDTH - 2 * SWITCH_CTL_X
const SWITCH_CTL_H = 28
const SWITCH_CTL_RX = 5
const SWITCH_CTL_RIGHT = SWITCH_CTL_X + SWITCH_CTL_W
const SWITCH_CTL_BOT = SWITCH_CTL_Y + SWITCH_CTL_H
const SWITCH_CTL_MID_X = SWITCH_CTL_X + Math.round(SWITCH_CTL_W / 2)
const SWITCH_CTL_TEXT_Y = SWITCH_CTL_Y + Math.round(SWITCH_CTL_H * 0.65)
const NUMERIC_BTN_W = 70
const TEMP_DOT_SIZE = 4
const TEMP_DIVISIONS = 14
const TEMP_MEASUREMENT_OFFSET = 1
const STEPS_MIN_COUNT = 1
const STEPS_PREVIEW_DEFAULT = 4
const SLIDER_PREVIEW_PCT = 60
const NUMERIC_PREVIEW_VALUE = 42

function buildSwitchCardSvg (title, label, controlSvg) {
  // Group icon: virtual switch device (phone/remote shape with pill + dot)
  const icon = `<svg x="8" y="3" width="14" height="14" viewBox="0 0 24 24" fill="none">
<path fill-rule="evenodd" clip-rule="evenodd" d="M13 6.2C13 5.53726 12.5523 5 12 5C11.4477 5 11 5.53726 11 6.2V9.8C11 10.4627 11.4477 11 12 11C12.5523 11 13 10.4627 13 9.8V6.2ZM13 16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16C11 15.4477 11.4477 15 12 15C12.5523 15 13 15.4477 13 16ZM15 16C15 17.6569 13.6569 19 12 19C10.3431 19 9 17.6569 9 16C9 14.3431 10.3431 13 12 13C13.6569 13 15 14.3431 15 16Z" fill="${SVG_COLOR_TEXT_DIM}"/>
<rect x="7" y="3" width="10" height="18" rx="3" stroke="${SVG_COLOR_TEXT_DIM}" stroke-width="2"/>
</svg>`
  return `<svg width="${SWITCH_CARD_WIDTH}" height="${SWITCH_CARD_HEIGHT}" viewBox="0 0 ${SWITCH_CARD_WIDTH} ${SWITCH_CARD_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
${icon}
<text x="28" y="16" font-family="${SVG_FONT}" font-size="12" fill="${SVG_COLOR_TEXT_DIM}">${escape(title)}</text>
<text x="${SWITCH_CTL_X}" y="${SWITCH_CARD_NAME_Y}" font-family="${SVG_FONT}" font-size="14" fill="${SVG_COLOR_TEXT}">${escape(label)}</text>
${controlSvg}
</svg>`
}

function buildToggleControl (isOn) {
  const halfW = SWITCH_CTL_MID_X - SWITCH_CTL_X
  const activeX = isOn ? SWITCH_CTL_MID_X : SWITCH_CTL_X
  const leftTextFill = isOn ? SVG_COLOR_TEXT_DIM : 'white'
  const rightTextFill = isOn ? 'white' : SVG_COLOR_TEXT_DIM
  return `<defs><clipPath id="sw-ctrl-clip"><rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}"/></clipPath></defs>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<rect x="${activeX}" y="${SWITCH_CTL_Y}" width="${halfW}" height="${SWITCH_CTL_H}" fill="${SVG_COLOR_ACTIVE}" clip-path="url(#sw-ctrl-clip)"/>
<line x1="${SWITCH_CTL_MID_X}" y1="${SWITCH_CTL_Y}" x2="${SWITCH_CTL_MID_X}" y2="${SWITCH_CTL_BOT}" stroke="white" stroke-width="1.5"/>
<text x="${(SWITCH_CTL_X + SWITCH_CTL_MID_X) / 2}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="${leftTextFill}">Off</text>
<text x="${(SWITCH_CTL_MID_X + SWITCH_CTL_RIGHT) / 2}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="${rightTextFill}">On</text>`
}

function buildMomentaryControl () {
  return `<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<text x="${SWITCH_CTL_MID_X}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="${SVG_COLOR_TEXT}">Press</text>`
}

function buildSliderControl (unit, showOff = false) {
  const fillW = Math.round(SWITCH_CTL_W * SLIDER_PREVIEW_PCT / 100)
  const markerX = SWITCH_CTL_X + fillW
  const valueText = unit ? `${SLIDER_PREVIEW_PCT} ${escape(unit)}` : `${SLIDER_PREVIEW_PCT}%`
  const offLabel = showOff ? `<text x="${SWITCH_CTL_X + 10}" y="${SWITCH_CTL_TEXT_Y}" font-family="${SVG_FONT}" font-size="13" fill="white">Off</text>` : ''
  return `<text x="${SWITCH_CTL_RIGHT}" y="${SWITCH_CARD_NAME_Y}" text-anchor="end" font-family="${SVG_FONT}" font-size="14" fill="${SVG_COLOR_TEXT_DIM}">${valueText}</text>
<defs><clipPath id="sw-ctrl-clip"><rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}"/></clipPath></defs>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${fillW}" height="${SWITCH_CTL_H}" fill="${SVG_COLOR_ACTIVE}" clip-path="url(#sw-ctrl-clip)"/>
<rect x="${markerX - 2}" y="${SWITCH_CTL_Y + 4}" width="4" height="${SWITCH_CTL_H - 8}" rx="2" fill="white"/>
${offLabel}`
}

function buildTempSliderControl (min = 0, max = 100, includeMeasurement = false) {
  const setpoint = (min + max) / 2
  const measurement = setpoint - TEMP_MEASUREMENT_OFFSET
  const valueText = includeMeasurement
    ? `${setpoint.toFixed(1)}/${measurement.toFixed(1)}°C`
    : `${setpoint.toFixed(1)}°C`
  const step = SWITCH_CTL_W / TEMP_DIVISIONS
  const dotY = SWITCH_CTL_Y + Math.round(SWITCH_CTL_H / 2) - Math.round(TEMP_DOT_SIZE / 2)
  const dots = []
  for (let i = 1; i < TEMP_DIVISIONS; i++) {
    const x = Math.round(SWITCH_CTL_X + i * step)
    if (i === TEMP_DIVISIONS / 2) {
      dots.push(`<rect x="${x - 2}" y="${SWITCH_CTL_Y + 4}" width="4" height="${SWITCH_CTL_H - 8}" rx="2" fill="white"/>`)
    } else {
      dots.push(`<rect x="${x - 2}" y="${dotY}" width="${TEMP_DOT_SIZE}" height="${TEMP_DOT_SIZE}" rx="2" fill="white"/>`)
    }
  }
  return `<text x="${SWITCH_CTL_RIGHT}" y="${SWITCH_CARD_NAME_Y}" text-anchor="end" font-family="${SVG_FONT}" font-size="14" fill="${SVG_COLOR_TEXT_DIM}">${escape(valueText)}</text>
<defs>
<linearGradient id="sw-temp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
<stop offset="0%" stop-color="${SVG_COLOR_TEMP_COLD}"/>
<stop offset="50%" stop-color="${SVG_COLOR_TEMP_MID}"/>
<stop offset="100%" stop-color="${SVG_COLOR_TEMP_HOT}"/>
</linearGradient>
</defs>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="url(#sw-temp-grad)"/>
<text x="${SWITCH_CTL_X + 8}" y="${SWITCH_CTL_TEXT_Y}" font-family="${SVG_FONT}" font-size="13" fill="white">Min</text>
<text x="${SWITCH_CTL_RIGHT - 8}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="end" font-family="${SVG_FONT}" font-size="13" fill="white">Max</text>
${dots.join('\n')}`
}

function buildStepsControl (steps) {
  const stepsCount = Math.max(STEPS_MIN_COUNT, Math.min(STEPPED_DEFAULT_MAX, steps || STEPS_PREVIEW_DEFAULT))
  const count = stepsCount + 1 // +1 for the implicit "Off" segment at position 0
  const sectionW = SWITCH_CTL_W / count
  const highlightIdx = Math.min(1, count - 1)
  const highlightX = Math.round(SWITCH_CTL_X + highlightIdx * sectionW)
  const highlightW = Math.round(sectionW)
  const dividers = []
  const labels = []
  for (let i = 1; i < count; i++) {
    const x = Math.round(SWITCH_CTL_X + i * sectionW)
    dividers.push(`<line x1="${x}" y1="${SWITCH_CTL_Y}" x2="${x}" y2="${SWITCH_CTL_BOT}" stroke="white" stroke-width="1.5"/>`)
  }
  for (let i = 0; i < count; i++) {
    const segMidX = Math.round(SWITCH_CTL_X + i * sectionW + sectionW / 2)
    const label = i === 0 ? 'Off' : String(i)
    const textFill = i === highlightIdx ? 'white' : SVG_COLOR_TEXT
    labels.push(`<text x="${segMidX}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="${textFill}">${label}</text>`)
  }
  return `<defs><clipPath id="sw-ctrl-clip"><rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}"/></clipPath></defs>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<rect x="${highlightX}" y="${SWITCH_CTL_Y}" width="${highlightW}" height="${SWITCH_CTL_H}" fill="${SVG_COLOR_ACTIVE}" clip-path="url(#sw-ctrl-clip)"/>
${dividers.join('\n')}
${labels.join('\n')}`
}

function buildDropdownControl (firstLabel) {
  const text = firstLabel ? escape(firstLabel.substring(0, 20)) : 'Option 1'
  const chevX = SWITCH_CTL_RIGHT - 20
  const chevMidY = SWITCH_CTL_Y + Math.round(SWITCH_CTL_H / 2)
  return `<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<text x="${SWITCH_CTL_X + 12}" y="${SWITCH_CTL_TEXT_Y}" font-family="${SVG_FONT}" font-size="13" fill="${SVG_COLOR_TEXT}">${text}</text>
<path d="M${chevX} ${chevMidY - 3} L${chevX + 8} ${chevMidY - 3} L${chevX + 4} ${chevMidY + 4} Z" fill="${SVG_COLOR_TEXT_DIM}"/>`
}

function buildNumericControl (unit) {
  const unitText = unit ? ` ${escape(unit.substring(0, 4))}` : ''
  const midLeft = SWITCH_CTL_X + NUMERIC_BTN_W
  const midRight = SWITCH_CTL_RIGHT - NUMERIC_BTN_W
  const strokeInset = 1
  return `<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<rect x="${midLeft}" y="${SWITCH_CTL_Y + strokeInset}" width="${midRight - midLeft}" height="${SWITCH_CTL_H - strokeInset * 2}" fill="white"/>
<line x1="${midLeft}" y1="${SWITCH_CTL_Y}" x2="${midLeft}" y2="${SWITCH_CTL_BOT}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="1.5"/>
<line x1="${midRight}" y1="${SWITCH_CTL_Y}" x2="${midRight}" y2="${SWITCH_CTL_BOT}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="1.5"/>
<text x="${SWITCH_CTL_X + Math.round(NUMERIC_BTN_W / 2)}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="16" fill="${SVG_COLOR_TEXT}">-</text>
<text x="${Math.round((midLeft + midRight) / 2)}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="${SVG_COLOR_TEXT}">${NUMERIC_PREVIEW_VALUE}${unitText}</text>
<text x="${midRight + Math.round(NUMERIC_BTN_W / 2)}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="16" fill="${SVG_COLOR_TEXT}">+</text>`
}

function buildThreeStateControl () {
  const btnGap = 5
  const autoW = 100
  const toggleW = SWITCH_CTL_W - btnGap - autoW // Off|On joined container (199px)
  const autoX = SWITCH_CTL_X + toggleW + btnGap
  const halfW = Math.round(toggleW / 2) // Off half width
  const divX = SWITCH_CTL_X + halfW // divider between Off and On
  const offMidX = Math.round(SWITCH_CTL_X + halfW / 2)
  const onHalfW = toggleW - halfW
  const onMidX = Math.round(divX + onHalfW / 2)
  const autoMidX = autoX + Math.round(autoW / 2)
  return `<defs><clipPath id="sw-ctrl-clip"><rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${toggleW}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}"/></clipPath></defs>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${toggleW}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${halfW}" height="${SWITCH_CTL_H}" fill="${SVG_COLOR_ACTIVE}" fill-opacity="${SVG_ACTIVE_FILL_OPACITY}" clip-path="url(#sw-ctrl-clip)"/>
<text x="${offMidX}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="white">Off</text>
<text x="${onMidX}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="${SVG_COLOR_TEXT_DIM}">On</text>
<rect x="${autoX}" y="${SWITCH_CTL_Y}" width="${autoW}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<text x="${autoMidX}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="${SVG_COLOR_TEXT_DIM}">Auto</text>`
}

function buildBilgePumpControl () {
  const badgeW = 88
  const badgeH = 18
  const badgeX = SWITCH_CTL_RIGHT - badgeW
  const badgeY = SWITCH_CARD_NAME_Y - badgeH + 2
  const badgeMidX = badgeX + Math.round(badgeW / 2)
  const badgeTextY = SWITCH_CARD_NAME_Y - 3
  return `<defs><clipPath id="sw-ctrl-clip"><rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}"/></clipPath></defs>
<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${Math.round(badgeH / 2)}" fill="${SVG_COLOR_SEPARATOR}"/>
<text x="${badgeMidX}" y="${badgeTextY}" text-anchor="middle" font-family="${SVG_FONT}" font-size="11" fill="${SVG_COLOR_TEXT_DIM}">Not running</text>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_W}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${SWITCH_CTL_MID_X - SWITCH_CTL_X}" height="${SWITCH_CTL_H}" fill="${SVG_COLOR_ACTIVE}" clip-path="url(#sw-ctrl-clip)"/>
<text x="${(SWITCH_CTL_X + SWITCH_CTL_MID_X) / 2}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="white">Auto</text>
<text x="${(SWITCH_CTL_MID_X + SWITCH_CTL_RIGHT) / 2}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="${SVG_COLOR_TEXT_DIM}">On</text>`
}

function buildRgbControl () {
  const swatchW = 28
  const swatchGap = 4
  const offBtnW = 40
  const mainCtlW = SWITCH_CTL_W - swatchW - swatchGap
  const swatchX = SWITCH_CTL_X + mainCtlW + swatchGap
  const sliderX = SWITCH_CTL_X + offBtnW
  const sliderW = mainCtlW - offBtnW
  const offMidX = Math.round(SWITCH_CTL_X + offBtnW / 2)
  const previewBrightness = 42
  const brightnessLineX = sliderX + Math.round(sliderW * previewBrightness / 100)
  const previewColor = '#FF5500'
  const fillW = brightnessLineX - SWITCH_CTL_X // filled area spans Off button + brightness fill
  const swatchBorder = 2
  const swatchWhite = 1
  const swatchInner = swatchBorder + swatchWhite
  return `<text x="${SWITCH_CTL_RIGHT}" y="${SWITCH_CARD_NAME_Y}" text-anchor="end" font-family="${SVG_FONT}" font-size="12" fill="${SVG_COLOR_TEXT_DIM}">${previewBrightness}%</text>
<defs><clipPath id="sw-ctrl-clip"><rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${mainCtlW}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}"/></clipPath></defs>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${mainCtlW}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_CTRL_BG}" stroke="${SVG_COLOR_ACTIVE}" stroke-width="2"/>
<rect x="${SWITCH_CTL_X}" y="${SWITCH_CTL_Y}" width="${fillW}" height="${SWITCH_CTL_H}" fill="${SVG_COLOR_ACTIVE}" fill-opacity="${SVG_ACTIVE_FILL_OPACITY}" clip-path="url(#sw-ctrl-clip)"/>
<line x1="${sliderX}" y1="${SWITCH_CTL_Y}" x2="${sliderX}" y2="${SWITCH_CTL_BOT}" stroke="white" stroke-width="1.5"/>
<text x="${offMidX}" y="${SWITCH_CTL_TEXT_Y}" text-anchor="middle" font-family="${SVG_FONT}" font-size="13" fill="white">Off</text>
<line x1="${brightnessLineX}" y1="${SWITCH_CTL_Y}" x2="${brightnessLineX}" y2="${SWITCH_CTL_BOT}" stroke="white" stroke-width="2"/>
<rect x="${swatchX}" y="${SWITCH_CTL_Y}" width="${swatchW}" height="${SWITCH_CTL_H}" rx="${SWITCH_CTL_RX}" fill="${SVG_COLOR_ACTIVE}"/>
<rect x="${swatchX + swatchBorder}" y="${SWITCH_CTL_Y + swatchBorder}" width="${swatchW - swatchBorder * 2}" height="${SWITCH_CTL_H - swatchBorder * 2}" rx="${SWITCH_CTL_RX - swatchBorder}" fill="white"/>
<rect x="${swatchX + swatchInner}" y="${SWITCH_CTL_Y + swatchInner}" width="${swatchW - swatchInner * 2}" height="${SWITCH_CTL_H - swatchInner * 2}" rx="${SWITCH_CTL_RX - swatchInner}" fill="${previewColor}"/>`
}

export function updateSwitchLivePreview () {
  const $preview = $('#switch-live-preview')
  if (!$preview.length) return

  const type = parseInt($('#node-input-switch_1_type').val(), 10)

  function placeholderOf (selector) {
    return ($('#' + selector).attr('placeholder') || '').replace(/^e\.g\.\s*/i, '').split(',')[0].trim()
  }

  const groupVal = $('#node-input-switch_1_group').val() || ''
  const title = groupVal || placeholderOf('node-input-switch_1_group') || 'Group'

  const customnameVal = $('#node-input-switch_1_customname').val() || ''
  const label = customnameVal || placeholderOf('node-input-switch_1_customname') || 'Name'

  let controlSvg
  switch (type) {
    case SWITCH_TYPE_MAP.TOGGLE:
      controlSvg = buildToggleControl(false)
      break
    case SWITCH_TYPE_MAP.MOMENTARY:
      controlSvg = buildMomentaryControl()
      break
    case SWITCH_TYPE_MAP.DIMMABLE:
      controlSvg = buildSliderControl('%', true)
      break
    case SWITCH_TYPE_MAP.TEMPERATURE_SETPOINT: {
      const min = parseFloat($('#node-input-switch_1_min').val()) || 0
      const max = parseFloat($('#node-input-switch_1_max').val()) || 100
      const includeMeasurement = $('#node-input-switch_1_include_measurement').is(':checked')
      controlSvg = buildTempSliderControl(min, max, includeMeasurement)
      break
    }
    case SWITCH_TYPE_MAP.STEPPED: {
      const steps = parseInt($('#node-input-switch_1_max').val(), 10) || STEPS_PREVIEW_DEFAULT
      controlSvg = buildStepsControl(steps)
      break
    }
    case SWITCH_TYPE_MAP.DROPDOWN: {
      const firstLabel = $('#node-input-switch_1_value_0').val() || ''
      controlSvg = buildDropdownControl(firstLabel)
      break
    }
    case SWITCH_TYPE_MAP.BASIC_SLIDER: {
      const unit = $('#node-input-switch_1_unit').val() || ''
      controlSvg = buildSliderControl(unit)
      break
    }
    case SWITCH_TYPE_MAP.NUMERIC_INPUT: {
      const unit = $('#node-input-switch_1_unit').val() || ''
      controlSvg = buildNumericControl(unit)
      break
    }
    case SWITCH_TYPE_MAP.THREE_STATE:
      controlSvg = buildThreeStateControl()
      break
    case SWITCH_TYPE_MAP.BILGE_PUMP:
      controlSvg = buildBilgePumpControl()
      break
    case SWITCH_TYPE_MAP.RGB_COLOR_WHEEL:
    case SWITCH_TYPE_MAP.CCT_WHEEL:
    case SWITCH_TYPE_MAP.RGB_WHITE_DIMMER:
      controlSvg = buildRgbControl()
      break
    default:
      controlSvg = buildToggleControl(false)
  }

  $preview.html(buildSwitchCardSvg(title, label, controlSvg))
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
  },
  pulsemeter: () => 2
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
 * Return the label for a single output port of a virtual device node.
 * @param {{ device?: string, enable_s2support?: boolean, switch_1_type?: number|string }} node
 * @param {number} index - Zero-based output index
 * @returns {string}
 */
export function determineOutputLabel (node, index) {
  if (index === 0) return 'Passthrough'

  if (node.device === 'pulsemeter') {
    return 'Aggregate'
  }

  if (node.device === 'acload' && node.enable_s2support) {
    return 'S2 communication'
  }

  if (node.device === 'switch') {
    const switchType = Number(node.switch_1_type !== undefined ? node.switch_1_type : SWITCH_TYPE_MAP.TOGGLE)
    const outputCount = SWITCH_OUTPUT_CONFIG[switchType] || 2

    if (index === 1) {
      return SWITCH_SECOND_OUTPUT_LABEL[switchType] || 'State'
    }

    if (index === 2 && outputCount >= 3) {
      return SWITCH_THIRD_OUTPUT_LABEL[switchType] || 'Value'
    }
  }

  return 'Output ' + (index + 1)
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

  if (context.device === 'pulsemeter') {
    labels.push('Aggregate')
  } else if (context.device === 'switch') {
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
 * Returns the Node-RED palette label for a virtual node.
 * Priority: name -> customname + group + typeName -> fallback + typeName
 * @param {{ name?: string, customname?: string, group?: string, typeName?: string, fallback?: string }} opts
 * @returns {string}
 */
export function getVirtualNodeLabel ({ name, customname, group, typeName, fallback = 'Virtual' } = {}) {
  if (name) return name
  const parts = [customname || fallback]
  if (group) parts.push('(' + group + ')')
  if (typeName) parts.push('[' + typeName + ']')
  return parts.join(' ')
}
