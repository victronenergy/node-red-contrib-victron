'use strict'

// Runs after e2e tests (always, even on failure).
// 1. Removes all non-system flows added during tests.
// 2. Uninstalls the package so the device is left in a clean state.

// TODO: we do not call this at the moment from the gihhub workflow.

const { fetchSessionCookie } = require('./vrm-auth.js')
const { nodeRedRequest, clearAllFlows } = require('./utils.js')

const PACKAGE_NAME = '@victronenergy/node-red-contrib-victron'
const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 60000

async function uninstallPackage (proxyDomain, sessionCookie) {
  console.log(`Uninstalling ${PACKAGE_NAME}...`)
  const res = await nodeRedRequest(proxyDomain, 'DELETE', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
  if (res.status === 204) {
    console.log('Package uninstalled')
  } else if (res.status === 404) {
    console.log('Package was not installed, nothing to remove')
  } else {
    console.warn(`DELETE /nodes returned ${res.status}: ${res.body}`)
  }
}

async function waitForNodeRed (proxyDomain, sessionCookie) {
  console.log('Waiting for Node-RED to restart after uninstall...')
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    try {
      const res = await nodeRedRequest(proxyDomain, 'GET', '/', sessionCookie)
      if (res.status === 200) { console.log('Node-RED is ready'); return }
    } catch (_) { }
    process.stdout.write('.')
  }
  console.warn('Node-RED did not come back within timeout - continuing anyway')
}

async function main () {
  const { sessionCookie, proxyDomain } = await fetchSessionCookie()
  await clearAllFlows(proxyDomain, sessionCookie)
  await uninstallPackage(proxyDomain, sessionCookie)
  await waitForNodeRed(proxyDomain, sessionCookie)
  console.log('Teardown complete')
}

main().catch(err => {
  // Log but do not exit 1 - teardown failures should not mask test results
  console.error('Teardown error (non-fatal):', err.message)
})
