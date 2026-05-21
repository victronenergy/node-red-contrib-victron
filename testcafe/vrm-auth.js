'use strict'

const https = require('https')

const VRM_INSTALLATION_ID = process.env.VRM_INSTALLATION_ID || '445836'
const VRM_API_TOKEN = process.env.VRM_API_TOKEN
const VRM_API_HOST = 'vrmapi.victronenergy.com'
const PROXY_DOMAIN = `${VRM_INSTALLATION_ID}-nodered.proxyrelay2.victronenergy.com`
const NODE_RED_ENDPOINT = `https://${PROXY_DOMAIN}`

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

async function fetchProxyToken () {
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
  return data.token
}

// Performs the two-step VRM proxy auth and returns the VRMPROXYSESSION cookie value.
// The cookie is valid for 24 hours (Max-Age=86400), so one call per fixture is sufficient.
async function fetchSessionCookie () {
  const proxyToken = await fetchProxyToken()
  const res = await httpsRequest({
    hostname: PROXY_DOMAIN,
    path: `/proxyauthorize?proxytoken=${proxyToken}`,
    method: 'GET',
    headers: { Accept: '*/*' }
  })
  const rawCookie = res.headers['set-cookie']
  if (!rawCookie) throw new Error('No Set-Cookie header in proxyauthorize response')
  const cookieStr = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie
  const match = cookieStr.match(/VRMPROXYSESSION=([^;]+)/)
  if (!match) throw new Error(`VRMPROXYSESSION not found in Set-Cookie: ${cookieStr}`)
  console.log(`VRM proxy session established for installation ${VRM_INSTALLATION_ID}`)
  return match[1]
}

module.exports = { fetchSessionCookie, NODE_RED_ENDPOINT, PROXY_DOMAIN, VRM_INSTALLATION_ID }
