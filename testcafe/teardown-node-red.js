'use strict'

// Runs after e2e tests (always, even on failure).
// 1. Removes all non-system flows added during tests.
// 2. Uninstalls the package so the device is left in a clean state.

// TODO: we do not call this at the moment from the gihhub workflow.

const https = require('https')
const { fetchSessionCookie, PROXY_DOMAIN } = require('./vrm-auth.js')

const PACKAGE_NAME = '@victronenergy/node-red-contrib-victron'
const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 60000

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

async function clearAllFlows (sessionCookie) {
  console.log('Fetching current flows revision...')
  const getRes = await nodeRedRequest('GET', '/flows', sessionCookie, null, { 'Node-RED-API-Version': 'v2' })
  if (getRes.status !== 200) {
    console.warn(`GET /flows returned ${getRes.status}, skipping flow cleanup`)
    return
  }
  const { rev } = JSON.parse(getRes.body)
  console.log(`Clearing all flows (rev ${rev})...`)
  const postRes = await nodeRedRequest('POST', '/flows', sessionCookie, { flows: [], rev }, { 'Node-RED-API-Version': 'v2' })
  if (postRes.status === 200 || postRes.status === 204) {
    console.log('All flows cleared')
  } else {
    console.warn(`POST /flows returned ${postRes.status}: ${postRes.body}`)
  }
}

async function uninstallPackage (sessionCookie) {
  console.log(`Uninstalling ${PACKAGE_NAME}...`)
  const res = await nodeRedRequest('DELETE', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
  if (res.status === 204) {
    console.log('Package uninstalled')
  } else if (res.status === 404) {
    console.log('Package was not installed, nothing to remove')
  } else {
    console.warn(`DELETE /nodes returned ${res.status}: ${res.body}`)
  }
}

async function waitForNodeRed (sessionCookie) {
  console.log('Waiting for Node-RED to restart after uninstall...')
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    try {
      const res = await nodeRedRequest('GET', '/', sessionCookie)
      if (res.status === 200) { console.log('Node-RED is ready'); return }
    } catch (_) { }
    process.stdout.write('.')
  }
  console.warn('Node-RED did not come back within timeout - continuing anyway')
}

async function main () {
  const sessionCookie = await fetchSessionCookie()
  await clearAllFlows(sessionCookie)
  await uninstallPackage(sessionCookie)
  await waitForNodeRed(sessionCookie)
  console.log('Teardown complete')
}

main().catch(err => {
  // Log but do not exit 1 - teardown failures should not mask test results
  console.error('Teardown error (non-fatal):', err.message)
})
