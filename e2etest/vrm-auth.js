'use strict'

const https = require('https')

const { VRM_INSTALLATION_ID, VRM_API_TOKEN } = process.env

if (!VRM_INSTALLATION_ID) throw new Error('VRM_INSTALLATION_ID environment variable is required')

const VRM_API_HOST = 'vrmapi.victronenergy.com'

function httpsRequest (options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function fetchProxyTokenAndRelay () {
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

// Performs the two-step VRM proxy auth and returns the VRMPROXYSESSION cookie value
// and the proxy domain to use for subsequent requests.
async function fetchSessionCookie () {
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

module.exports = { fetchSessionCookie, VRM_INSTALLATION_ID }
