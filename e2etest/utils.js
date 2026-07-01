'use strict'

import https from 'https'
import { readFileSync } from 'fs'
import testcafe from 'testcafe'

const { Selector } = testcafe

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

export function nodeRedRequest (proxyDomain, method, path, sessionCookie, body, extraHeaders) {
  const bodyStr = body ? JSON.stringify(body) : undefined
  return httpsRequest({
    hostname: proxyDomain,
    path,
    method,
    headers: {
      cookie: `VRMPROXYSESSION=${sessionCookie}`,
      ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      ...(extraHeaders || {})
    }
  }, bodyStr)
}

export async function clearAllFlows (proxyDomain, sessionCookie) {
  console.log('Fetching current flows revision...')
  const getRes = await nodeRedRequest(proxyDomain, 'GET', '/flows', sessionCookie, null, { 'Node-RED-API-Version': 'v2' })
  if (getRes.status !== 200) {
    console.warn(`GET /flows returned ${getRes.status}, skipping flow cleanup`)
    return
  }
  const { rev } = JSON.parse(getRes.body)
  console.log(`Clearing all flows (rev ${rev})...`)
  const postRes = await nodeRedRequest(proxyDomain, 'POST', '/flows', sessionCookie, { flows: [], rev }, { 'Node-RED-API-Version': 'v2' })
  if (postRes.status === 200 || postRes.status === 204) {
    console.log('All flows cleared')
  } else {
    console.warn(`POST /flows returned ${postRes.status}: ${postRes.body}`)
  }
}

let NODE_RED_ENDPOINT = process.env.NODE_RED_ENDPOINT || null
let PROXY_DOMAIN = null

export function getNodeRedEndpoint () {
  if (!NODE_RED_ENDPOINT) {
    throw new Error('NODE_RED_ENDPOINT is not set. Make sure to call setupVrmFixture on your fixture, or set NODE_RED_ENDPOINT in the environment.')
  }
  return NODE_RED_ENDPOINT
}

// t.request uses TestCafe's own network stack, not the browser cookie jar,
// so we must add the session cookie explicitly to every request header.
function vrmRequestHeaders (t) {
  const sessionCookie = t.fixtureCtx && t.fixtureCtx.sessionCookie
  return sessionCookie ? { cookie: `VRMPROXYSESSION=${sessionCookie}` } : {}
}

// Call on a fixture object to wire up VRM proxy auth.
// Fetches a 24-hour session cookie once before the suite, then injects it
// into the browser and into t.request headers before each test.
export function setupVrmFixture (fixture) {
  if (NODE_RED_ENDPOINT) {
    console.warn(`WARNING: Using NODE_RED_ENDPOINT from environment: ${NODE_RED_ENDPOINT}.`)
    return fixture.page(NODE_RED_ENDPOINT)
  } else {
    return fixture
      .page('about:blank')
      .before(async ctx => {
        const { sessionCookie, proxyDomain } = await fetchSessionCookie()
        ctx.sessionCookie = sessionCookie
        PROXY_DOMAIN = proxyDomain
        NODE_RED_ENDPOINT = `https://${proxyDomain}`
        console.log(`Fetched VRM session cookie, proxy domain: ${proxyDomain}, Node-RED endpoint: ${NODE_RED_ENDPOINT}`)
      })
      .beforeEach(async t => {
        await t.setCookies([{
          name: 'VRMPROXYSESSION',
          value: t.fixtureCtx.sessionCookie,
          domain: PROXY_DOMAIN,
          path: '/',
          secure: true,
          httpOnly: true
        }])
        await t.navigateTo(NODE_RED_ENDPOINT)
      })
  }
}

export async function setupFlow (t, flowName, nameOverride) {
  console.log(`Setting up flow: ${flowName}`)
  const flowAsText = readFileSync(`./e2etest/setup/${flowName}.json`, 'utf8')
  const flow = JSON.parse(flowAsText)
  if (nameOverride) flow.label = nameOverride

  const existingFlows = await t.request.get(`${NODE_RED_ENDPOINT}/flows`, {
    headers: {
      'Node-RED-API-Version': 'v2',
      ...vrmRequestHeaders(t)
    }
  }).then(async res => {
    await t.expect(res.status).eql(200)
    console.log(`Existing flows response: ${res.status}`, Object.keys(res.body))
    return res.body.flows
  })

  for (const existingFlow of existingFlows) {
    if (existingFlow.label === flow.label) {
      console.log(`Deleting existing flow: ${existingFlow.id} - ${existingFlow.label}`)
      const deleteResult = await t.request.delete(`${NODE_RED_ENDPOINT}/flow/${existingFlow.id}`, {
        headers: vrmRequestHeaders(t)
      })
      await t.expect(deleteResult.status).eql(204)
    }
  }

  const result = await t.request.post(`${NODE_RED_ENDPOINT}/flow`, {
    headers: {
      'Content-Type': 'application/json',
      ...vrmRequestHeaders(t)
    },
    body: flow
  })
  console.log(`Flow setup response: ${result.status}`, result.body)
  await t.expect(result.status).eql(200)
  return result.body.id
}

export async function getExistingNodeIds () {
  const existingNodes = Selector('#red-ui-workspace-chart .red-ui-flow-node.red-ui-flow-node-group')
  const count = await existingNodes.count
  console.log(`Found ${count} existing nodes on workspace`)
  return Promise.all(Array.from({ length: count }, (_, i) => existingNodes.nth(i).getAttribute('id')))
}

export async function confirmNodeDialog (t) {
  await t.click('#node-dialog-ok')
}

export async function deploy (t) {
  await t.click('#red-ui-header-button-deploy')
  const notification = Selector('#red-ui-notifications div p').innerText
  await t.expect(notification).eql('Successfully deployed')
}

let nextNodeOffsetY = 200

export function resetFlowNodeOffset () {
  nextNodeOffsetY = 200
}

export async function addNodeToCurrentFlow (t, nodePaletteType) {
  const existingNodeIds = await getExistingNodeIds()
  const paletteItem = Selector(`.red-ui-palette-node[data-palette-type="${nodePaletteType}"]`).find('.red-ui-palette-label')
  await t.dragToElement(paletteItem, Selector('#red-ui-workspace-chart'), {
    destinationOffsetX: 400,
    destinationOffsetY: nextNodeOffsetY
  })
  nextNodeOffsetY += 30
  const nodeIdsAfter = await getExistingNodeIds()
  const newNodeIds = nodeIdsAfter.filter(id => !existingNodeIds.includes(id))
  if (newNodeIds.length !== 1) {
    throw new Error(`Expected exactly one new node, found ${newNodeIds.length}. Before: [${existingNodeIds.join(', ')}], after: [${nodeIdsAfter.join(', ')}]`)
  }
  return newNodeIds[0]
}

// Performs the two-step VRM proxy auth and returns the VRMPROXYSESSION cookie value
// and the proxy domain to use for subsequent requests.
export async function fetchSessionCookie () {
  const { token: proxyToken, proxyDomain } = await fetchProxyTokenAndRelay()
  const res = await httpsRequest({
    hostname: proxyDomain,
    path: `/proxyauthorize?proxytoken=${proxyToken}`,
    method: 'GET',
    headers: { Accept: '*/*' }
  })
  const rawCookie = res.headers['set-cookie']
  if (!rawCookie) throw new Error('No Set-Cookie header in proxyauthorize response')
  const cookieStr = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie
  const match = cookieStr.match(/VRMPROXYSESSION=([^;]+)/)
  if (!match) throw new Error(`VRMPROXYSESSION not found in Set-Cookie: ${cookieStr}`)
  console.log(`VRM proxy session established for installation ${VRM_INSTALLATION_ID} via ${proxyDomain}`)
  return { sessionCookie: match[1], proxyDomain }
}

const { VRM_INSTALLATION_ID, VRM_API_TOKEN } = process.env

if (!VRM_INSTALLATION_ID) throw new Error('VRM_INSTALLATION_ID environment variable is required')

const VRM_API_HOST = 'vrmapi.victronenergy.com'

export async function fetchProxyTokenAndRelay () {
  if (!VRM_API_TOKEN) throw new Error('VRM_API_TOKEN environment variable is required')
  const res = await httpsRequest({
    hostname: VRM_API_HOST,
    path: `/v2/installations/${VRM_INSTALLATION_ID}/proxy-relay/nodered`,
    method: 'POST',
    headers: {
      'x-authorization': `Token ${VRM_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': 0
    }
  })
  if (res.status !== 200) throw new Error(`proxy-relay request failed: ${res.status} ${res.body}`)
  const data = JSON.parse(res.body)
  if (!data.success || !data.token) throw new Error(`Unexpected proxy-relay response: ${res.body}`)
  // proxy_relay is e.g. "*.proxyrelay7.victronenergy.com"
  const relayDomain = data.proxy_relay ? data.proxy_relay.replace(/^\*\./, '') : 'proxyrelay2.victronenergy.com'
  const proxyDomain = `${VRM_INSTALLATION_ID}-nodered.${relayDomain}`
  return { token: data.token, proxyDomain }
}
