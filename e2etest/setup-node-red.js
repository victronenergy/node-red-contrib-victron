'use strict'

// Installs @victronenergy/node-red-contrib-victron on the remote Node-RED
// instance via the VRM proxy before e2e tests run.
//
// Usage: node testcafe/setup-node-red.js --url <tarball-url>
//
// The tarball URL must be publicly reachable from the GX device. In the
// GitHub Actions workflow this is produced by: npm pack && gh release create (prerelease).

const { nodeRedRequest, fetchSessionCookie, clearAllFlows } = require('./utils.js')

const PACKAGE_NAME = '@victronenergy/node-red-contrib-victron'
const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 120000

const args = process.argv.slice(2)
const urlFlag = args.indexOf('--url')
if (urlFlag === -1 || !args[urlFlag + 1]) {
  console.error('Usage: node setup-node-red.js --url <tarball-url>')
  process.exit(1)
}
const TARBALL_URL = args[urlFlag + 1]

async function waitForNodeRed (proxyDomain, sessionCookie) {
  console.log(`Waiting for Node-RED to come back up (max ${MAX_WAIT_MS / 1000}s)...`)
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    try {
      const res = await nodeRedRequest(proxyDomain, 'GET', '/', sessionCookie)
      if (res.status === 200) {
        console.log('Node-RED is ready')
        return
      }
    } catch (_) { }
    process.stdout.write('.')
  }
  throw new Error(`Node-RED did not become ready within ${MAX_WAIT_MS / 1000}s`)
}

async function uninstallIfPresent (proxyDomain, sessionCookie) {
  try {
    const check = await nodeRedRequest(proxyDomain, 'GET', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
    console.log(`Checking if ${PACKAGE_NAME} is already installed: now=${new Date().toISOString()}, result:`, check)
    if (check.status === 404) return false
    if (check.status !== 200) {
      throw new Error(`Unexpected status ${check.status} from GET /nodes: ${check.body}`)
    }
    console.log(`${PACKAGE_NAME} already installed - uninstalling first..., now=${new Date().toISOString()}`)
    const del = await nodeRedRequest(proxyDomain, 'DELETE', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
    if (del.status === 204) {
      console.log(`Uninstall successful, waiting for Node-RED to restart..., now=${new Date().toISOString()}`)
      await waitForNodeRed(proxyDomain, sessionCookie)
      return true
    } else {
      console.log(`Uninstall failed: ${del.status} ${del.body}, now=${new Date().toISOString()}`)
    }
    const body = JSON.parse(del.body || '{}')
    if (body.code === 'type_in_use') {
      console.log('type_in_use: clearing all flows first, then retrying uninstall...')
      await clearAllFlows(proxyDomain, sessionCookie)
      await waitForNodeRed(proxyDomain, sessionCookie)
      const retry = await nodeRedRequest(proxyDomain, 'DELETE', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
      if (retry.status !== 204) throw new Error(`DELETE /nodes retry failed: ${retry.status} ${retry.body}`)
      await waitForNodeRed(proxyDomain, sessionCookie)
      return true
    }
    throw new Error(`DELETE /nodes failed: ${del.status} ${del.body}`)
  } catch (err) {
    console.error(`Error during uninstall check/uninstall: ${err.message}`)
    console.error(err)
    throw err
  }
}

async function installPackage (proxyDomain, sessionCookie) {
  console.log(`Installing ${PACKAGE_NAME} from ${TARBALL_URL}`)
  const res = await nodeRedRequest(proxyDomain, 'POST', '/nodes', sessionCookie, {
    module: PACKAGE_NAME,
    url: TARBALL_URL
  })
  if (res.status !== 200) throw new Error(`POST /nodes failed: ${res.status} ${res.body}`)
  console.log('Install request accepted')
}

async function main () {
  const { sessionCookie, proxyDomain } = await fetchSessionCookie()
  try {
    await clearAllFlows(proxyDomain, sessionCookie)
  } catch (err) {
    console.warn('Error clearing flows, continuing anyway:', err.message)
  }
  await uninstallIfPresent(proxyDomain, sessionCookie)
  await installPackage(proxyDomain, sessionCookie)
  await waitForNodeRed(proxyDomain, sessionCookie)
  console.log('Node-RED setup complete')
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
