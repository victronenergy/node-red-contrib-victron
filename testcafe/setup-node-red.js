'use strict'

// Installs @victronenergy/node-red-contrib-victron on the remote Node-RED
// instance via the VRM proxy before e2e tests run.
//
// Usage: node testcafe/setup-node-red.js --url <tarball-url>
//
// The tarball URL must be publicly reachable from the GX device. In the
// GitHub Actions workflow this is produced by: npm pack && gh release create (prerelease).

const https = require('https')
const { fetchSessionCookie, PROXY_DOMAIN } = require('./vrm-auth.js')

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

function httpsRequest (options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function nodeRedRequest (method, path, sessionCookie, body, extraHeaders) {
  const bodyStr = body ? JSON.stringify(body) : undefined
  return httpsRequest({
    hostname: PROXY_DOMAIN,
    path,
    method,
    headers: {
      cookie: `VRMPROXYSESSION=${sessionCookie}`,
      ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      ...(extraHeaders || {})
    }
  }, bodyStr)
}

async function waitForNodeRed (sessionCookie) {
  console.log(`Waiting for Node-RED to come back up (max ${MAX_WAIT_MS / 1000}s)...`)
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    try {
      const res = await nodeRedRequest('GET', '/', sessionCookie)
      if (res.status === 200) {
        console.log('Node-RED is ready')
        return
      }
    } catch (_) {}
    process.stdout.write('.')
  }
  throw new Error(`Node-RED did not become ready within ${MAX_WAIT_MS / 1000}s`)
}

async function clearAllFlows (sessionCookie) {
  const getRes = await nodeRedRequest('GET', '/flows', sessionCookie, null, { 'Node-RED-API-Version': 'v2' })
  if (getRes.status !== 200) return
  const { rev } = JSON.parse(getRes.body)
  const postRes = await nodeRedRequest('POST', '/flows', sessionCookie, { flows: [], rev }, { 'Node-RED-API-Version': 'v2' })
  console.log(`Cleared all flows: ${postRes.status}`)
}

async function uninstallIfPresent (sessionCookie) {
  const check = await nodeRedRequest('GET', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
  if (check.status === 404) return false
  console.log(`${PACKAGE_NAME} already installed - uninstalling first..., now=${new Date().toISOString()}`)
  const del = await nodeRedRequest('DELETE', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
  if (del.status === 204) {
    console.log(`Uninstall successful, waiting for Node-RED to restart..., now=${new Date().toISOString()}`)
    await waitForNodeRed(sessionCookie)
    return true
  } else {
    console.log(`Uninstall failed: ${del.status} ${del.body}, now=${new Date().toISOString()}`)
  }
  const body = JSON.parse(del.body || '{}')
  if (body.code === 'type_in_use') {
    console.log('type_in_use: clearing all flows first, then retrying uninstall...')
    await clearAllFlows(sessionCookie)
    await waitForNodeRed(sessionCookie)
    const retry = await nodeRedRequest('DELETE', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
    if (retry.status !== 204) throw new Error(`DELETE /nodes retry failed: ${retry.status} ${retry.body}`)
    await waitForNodeRed(sessionCookie)
    return true
  }
  throw new Error(`DELETE /nodes failed: ${del.status} ${del.body}`)
}

async function installPackage (sessionCookie) {
  console.log(`Installing ${PACKAGE_NAME} from ${TARBALL_URL}`)
  const res = await nodeRedRequest('POST', '/nodes', sessionCookie, {
    module: PACKAGE_NAME,
    url: TARBALL_URL
  })
  if (res.status !== 200) throw new Error(`POST /nodes failed: ${res.status} ${res.body}`)
  console.log('Install request accepted')
}

async function main () {
  const sessionCookie = await fetchSessionCookie()
  await uninstallIfPresent(sessionCookie)
  await installPackage(sessionCookie)
  await waitForNodeRed(sessionCookie)
  console.log('Node-RED setup complete')
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
