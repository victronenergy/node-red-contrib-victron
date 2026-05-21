'use strict'

// Ensures @victronenergy/node-red-contrib-victron is installed on the remote
// Node-RED instance before e2e tests run. Authenticates via VRM proxy,
// checks the current installation, installs/updates if needed, and waits
// for Node-RED to come back up.

const https = require('https')
const { fetchSessionCookie, PROXY_DOMAIN } = require('./vrm-auth.js')

const PACKAGE_NAME = '@victronenergy/node-red-contrib-victron'
const PACKAGE_VERSION = require('../package.json').version
const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 90000

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

function nodeRedRequest (method, path, sessionCookie, body) {
  const bodyStr = body ? JSON.stringify(body) : undefined
  return httpsRequest({
    hostname: PROXY_DOMAIN,
    path,
    method,
    headers: {
      cookie: `VRMPROXYSESSION=${sessionCookie}`,
      ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {})
    }
  }, bodyStr)
}

async function getInstalledVersion (sessionCookie) {
  const res = await nodeRedRequest('GET', `/nodes/${encodeURIComponent(PACKAGE_NAME)}`, sessionCookie)
  if (res.status === 404) return null
  if (res.status !== 200) throw new Error(`GET /nodes failed: ${res.status} ${res.body}`)
  return JSON.parse(res.body).version || null
}

async function installPackage (sessionCookie) {
  console.log(`Installing ${PACKAGE_NAME}@${PACKAGE_VERSION}...`)
  const res = await nodeRedRequest('POST', '/nodes', sessionCookie, {
    module: PACKAGE_NAME,
    version: PACKAGE_VERSION
  })
  if (res.status !== 200) throw new Error(`POST /nodes failed: ${res.status} ${res.body}`)
  console.log('Install request accepted, waiting for Node-RED to restart...')
}

async function waitForNodeRed (sessionCookie) {
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    try {
      const res = await nodeRedRequest('GET', '/', sessionCookie)
      if (res.status === 200) {
        console.log('Node-RED is ready')
        return
      }
      console.log(`Node-RED returned ${res.status}, still waiting...`)
    } catch (_) {
      console.log('Node-RED not responding yet, still waiting...')
    }
  }
  throw new Error(`Node-RED did not become ready within ${MAX_WAIT_MS / 1000}s`)
}

async function main () {
  console.log(`Checking ${PACKAGE_NAME} on Node-RED (target: ${PACKAGE_VERSION})...`)

  const sessionCookie = await fetchSessionCookie()
  const installedVersion = await getInstalledVersion(sessionCookie)

  console.log(`Installed: ${installedVersion || 'not installed'}, target: ${PACKAGE_VERSION}`)

  if (installedVersion === PACKAGE_VERSION) {
    console.log('Already at correct version, skipping install')
    return
  }

  await installPackage(sessionCookie)
  await waitForNodeRed(sessionCookie)
  console.log('Node-RED setup complete')
}

main().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
