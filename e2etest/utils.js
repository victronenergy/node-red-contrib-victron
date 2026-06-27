const { readFileSync } = require('fs')
const https = require('https')
const { Selector } = require('testcafe')
const { fetchSessionCookie } = require('./vrm-auth.js')

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

// Populated at fixture-before time by setupVrmFixture; safe to import statically
// because test functions always run after fixture.before completes.
// allow dynamic override for testing without VRM auth
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
