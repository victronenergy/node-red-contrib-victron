const { setupFlow, NODE_RED_ENDPOINT, getExistingNodeIds, confirmNodeDialog, deploy, setupVrmFixture } = require('./utils.js')
const { mqtt_GetValue, mqtt_SetValue } = require('./mqtt-verify.js')
const { Selector } = require('testcafe')
const { SWITCH_TYPE_NAMES } = require('../src/nodes/victron-virtual-constants.js')

const SKIP_MQTT = process.env.SKIP_MQTT_VERIFICATION === 'true'

setupVrmFixture(
  fixture('Virtual Switches')
)

function getSwitchTypeCodeForName (name) {
  for (const [code, typeName] of Object.entries(SWITCH_TYPE_NAMES)) {
    if (typeName === name) return code
  }
  throw new Error(`Unknown switch type name: ${name}`)
}

let nextNodeOffsetY = 200

function resetSwitchNodeOffset () {
  nextNodeOffsetY = 200
}

async function addVirtualSwitchNode (t) {
  const existingNodeIds = await getExistingNodeIds()
  const paletteItem = Selector('.red-ui-palette-node[data-palette-type="victron-virtual-switch"]').find('.red-ui-palette-label')
  await t.dragToElement(paletteItem, Selector('#red-ui-workspace-chart'), {
    destinationOffsetX: 400,
    destinationOffsetY: nextNodeOffsetY
  })
  nextNodeOffsetY += 30
  const nodeIdsAfter = await getExistingNodeIds()
  const newNodeIds = nodeIdsAfter.filter(id => !existingNodeIds.includes(id))
  if (newNodeIds.length !== 1) {
    throw new Error(`Expected exactly one new node, found ${newNodeIds.length}`)
  }
  return newNodeIds[0]
}

async function configureVirtualSwitchNode (t, nodeId, options) {
  const nodeSelector = Selector('g').withAttribute('id', nodeId)
  await t.doubleClick(nodeSelector)
  for (const { name, value, type = 'text' } of options) {
    const inputSelector = Selector(`#node-input-${name}`)
    if (type === 'text') {
      await t.selectText(inputSelector).pressKey('delete')
      await t.typeText(inputSelector, value)
    } else if (type === 'select') {
      await t.click(inputSelector)
      await t.click(Selector(`#node-input-${name} option`).withText(value))
    } else {
      throw new Error(`Unsupported option type: ${type}`)
    }
  }
}

async function assertSwitchValue (t, nodeId, path, expectedContains) {
  if (SKIP_MQTT) {
    console.log(`SKIP_MQTT_VERIFICATION: skipping assertion ${nodeId} ${path} contains "${expectedContains}"`)
    return
  }
  const result = await mqtt_GetValue(`com.victronenergy.switch.virtual_${nodeId}`, path)
  await t.expect(JSON.stringify(result)).contains(String(expectedContains))
}

test('Configure switch types from empty flow', async t => {
  const flowId = await setupFlow(t, 'empty-flow')
  resetSwitchNodeOffset()
  await t.navigateTo(`${NODE_RED_ENDPOINT}/#flow/${flowId}`)
  await t.eval(() => location.reload(true))
  await t.expect(Selector('.red-ui-tab.active').withAttribute('id', `red-ui-tab-${flowId}`).exists).ok('Flow tab did not become active')

  const switchesToTest = [
    { name: 'momentary1', type: 'Momentary' },
    { name: 'toggle1', type: 'Toggle' },
    { name: 'dimmable1', type: 'Dimmable' },
    {
      name: 'temp1',
      type: 'Temperature setpoint',
      props: [{ switch_1_min: '0', switch_1_max: '30', switch_1_step: '0.5' }]
    },
    {
      name: 'stepped1',
      type: 'Stepped switch',
      props: [{ switch_1_max: '12' }]
    },
    {
      name: 'dropdown1',
      type: 'Dropdown',
      props: [{ switch_1_count: '3', switch_1_value_0: 'option one', switch_1_value_1: 'option two', switch_1_value_2: 'option three' }]
    },
    {
      name: 'slider1',
      type: 'Basic slider',
      props: [{ switch_1_min: '0', switch_1_max: '100', switch_1_step: '2', switch_1_unit: '%' }]
    },
    {
      name: 'numeric1',
      type: 'Numeric input',
      props: [{ switch_1_min: '-50', switch_1_max: '70', switch_1_step: '0.5', switch_1_unit: '°C' }]
    },
    { name: 'threestate1', type: 'Three-state switch' },
    { name: 'bilgepump1', type: 'Bilge pump control' },
    { name: 'rgb1', type: 'RGB control' }
  ]

  for (const switchConfig of switchesToTest) {
    console.log(`Testing switch: ${switchConfig.name} (${switchConfig.type})`)
    const newSwitchId = await addVirtualSwitchNode(t)

    const options = [
      { name: 'name', value: switchConfig.name },
      { name: 'switch_1_type', value: switchConfig.type, type: 'select' },
      { name: 'switch_1_customname', value: switchConfig.name },
      { name: 'switch_1_group', value: 'testcafe' }
    ]

    if (switchConfig.props) {
      for (const prop of switchConfig.props) {
        for (const [key, value] of Object.entries(prop)) {
          options.push({ name: key, value })
        }
      }
    }

    const getOption = name => options.find(o => o.name === name).value

    await configureVirtualSwitchNode(t, newSwitchId, options)
    await confirmNodeDialog(t)
    await deploy(t)

    if (switchConfig.type === 'Numeric input') {
      await assertSwitchValue(t, newSwitchId, '/SwitchableOutput/output_1/Dimming', 0)
    } else {
      await assertSwitchValue(t, newSwitchId, '/SwitchableOutput/output_1/State', 0)
    }
    await assertSwitchValue(t, newSwitchId, '/SwitchableOutput/output_1/Settings/CustomName', getOption('name'))
    await assertSwitchValue(t, newSwitchId, '/SwitchableOutput/output_1/Settings/Group', getOption('switch_1_group'))
    await assertSwitchValue(t, newSwitchId, '/SwitchableOutput/output_1/Settings/Type', getSwitchTypeCodeForName(getOption('switch_1_type')))
  }
})

test('Set and read switch state via MQTT', async t => {
  const flowId = await setupFlow(t, 'flow-switches-1')
  await t.navigateTo(`${NODE_RED_ENDPOINT}/#flow/${flowId}`)
  await t.eval(() => location.reload(true))
  await t.expect(Selector('.red-ui-tab.active').withAttribute('id', `red-ui-tab-${flowId}`).exists).ok('Flow tab did not become active')

  if (SKIP_MQTT) {
    console.log('SKIP_MQTT_VERIFICATION: skipping switch state assertions')
    return
  }

  await mqtt_SetValue('com.victronenergy.switch.virtual_switch1', '/SwitchableOutput/output_1/State', 1)
  const stateOn = await mqtt_GetValue('com.victronenergy.switch.virtual_switch1', '/SwitchableOutput/output_1/State')
  await t.expect(JSON.stringify(stateOn)).contains('1')

  await mqtt_SetValue('com.victronenergy.switch.virtual_switch1', '/SwitchableOutput/output_1/State', 0)
  const stateOff = await mqtt_GetValue('com.victronenergy.switch.virtual_switch1', '/SwitchableOutput/output_1/State')
  await t.expect(JSON.stringify(stateOff)).contains('0')
})
