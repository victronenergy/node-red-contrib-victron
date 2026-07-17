/* globals fixture, test */
const { setupFlow, getNodeRedEndpoint, redeployFlow, setupVrmFixture } = require('./utils.js')
const { mqttGetValue, mqttSetValue, invalidateMqttValue } = require('./mqtt-verify.js')
const { Selector } = require('testcafe')

setupVrmFixture(
  fixture('Virtual Switch Persistence')
)

test('Dropdown switch value survives a redeploy restart', async t => {
  const flowId = await setupFlow(t, 'flow-switches-dropdown-persist')
  await t.navigateTo(`${getNodeRedEndpoint()}/#flow/${flowId}`)
  await t.eval(() => location.reload(true)) // eslint-disable-line no-undef
  await t.expect(
    Selector('.red-ui-tab.active').withAttribute('id', `red-ui-tab-${flowId}`).exists
  ).ok('Flow tab did not become active', { timeout: 30_000 })

  const serviceName = 'com.victronenergy.switch.virtual_swdropdownpersist1'
  const path = '/SwitchableOutput/output_1/Dimming'

  // Select the third option (index 2) - away from the default of 0, so a
  // reset-to-default after restart is distinguishable from a real persist.
  console.log('Setting dropdown value to 2 via MQTT...')
  await mqttSetValue(serviceName, path, 2)
  const beforeRestart = await mqttGetValue(serviceName, path)
  console.log('Value before restart:', beforeRestart)
  await t.expect(JSON.stringify(beforeRestart)).contains('2')

  // Drop the cached value so the next read can only resolve once the node
  // republishes after restarting, proving the persisted value was actually
  // reloaded rather than just replaying what MQTT had cached before.
  await invalidateMqttValue(serviceName, path)

  console.log('Redeploying flow', flowId, 'to restart its nodes...')
  await redeployFlow(t, flowId)
  console.log('Redeploy request completed, waiting for node to republish...')

  const afterRestart = await mqttGetValue(serviceName, path)
  console.log('Value after restart:', afterRestart)
  await t.expect(JSON.stringify(afterRestart)).contains('2')
})
