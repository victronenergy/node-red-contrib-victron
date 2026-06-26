/* global fixture, test, location */

const { setupFlow, getNodeRedEndpoint, addNodeToCurrentFlow, resetFlowNodeOffset, confirmNodeDialog, deploy, setupVrmFixture } = require('./utils.js')
const { Selector } = require('testcafe')

setupVrmFixture(
  fixture('Virtual Devices Deployment')
)

async function configureVirtualDeviceNode (t, nodeId, device, properties) {
  const nodeSelector = Selector('g').withAttribute('id', nodeId)
  await t.doubleClick(nodeSelector)

  await t.click(Selector('#node-input-device'))
  await t.click(Selector('#node-input-device option').withText(device))

  for (const [name, spec] of Object.entries(properties)) {
    const inputSelector = Selector(`#node-input-${name}`)
    if (typeof spec === 'string') {
      await t.selectText(inputSelector).pressKey('delete')
      await t.typeText(inputSelector, spec)
    } else {
      const { type, value } = spec
      if (type === 'checkbox') {
        if (value) await t.click(Selector(`#node-input-${name} + label`))
      } else if (type === 'text') {
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
}

test('Deploy virtual devices', async t => {
  const flowId = await setupFlow(t, 'empty-flow', 'Virtual Devices')
  console.log('Flow deployed with ID:', flowId)

  await t.navigateTo(`${getNodeRedEndpoint()}/#flow/${flowId}`)
  await t.eval(() => location.reload(true))
  await t.expect(Selector('.red-ui-tab.active').withAttribute('id', `red-ui-tab-${flowId}`).exists).ok('Flow tab did not become active')

  resetFlowNodeOffset()

  const nodesToTest = [
    {
      name: 'acload1',
      device: 'AC Load',
      properties: {
        acload_nrofphases: { type: 'select', value: 'Split phase' },
        enable_s2support: { type: 'checkbox', value: true }
      }
    },
    {
      name: 'battery1',
      device: 'Battery',
      properties: {
        battery_capacity: '50'
      }
    }
  ]

  for (const { name, device, properties } of nodesToTest) {
    console.log(`Adding node: ${name} of type ${device}`)
    const nodeId = await addNodeToCurrentFlow(t, 'victron-virtual')
    await configureVirtualDeviceNode(t, nodeId, device, properties)
    await confirmNodeDialog(t)
  }

  await deploy(t)
})
