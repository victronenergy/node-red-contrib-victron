'use strict'

/**
 * Format event string for D-Bus injection into com.victronenergy.logger /EventLogging/Inject
 * @param {number} eventType - 0=Venus OS core, 1=Venus OS app
 * @param {number} severity - 0=WARNING, 1=CRITICAL, 2=INFO
 * @param {string} app - Identifying name of the application sending the event
 * @param {string} message - Event message text
 * @returns {string} Formatted string "eventType\tseverity\tapp\tmessage"
 */
const sanitize = (s) => String(s).replace(/[\t\r\n]/g, ' ').trim()

function formatEvent (eventType, severity, app, message) {
  return `${eventType}\t${severity}\t${sanitize(app)}\t${sanitize(message)}`
}

const MAX_SEVERITY = 2
const SEVERITY_ERROR = `Severity must be "warning", "critical", "info", or 0-${MAX_SEVERITY}`

/**
 * Validate event input parameters
 * @param {*} payload - The message payload (event message text)
 * @param {*} severity - 0=WARNING, 1=CRITICAL, 2=INFO, or string equivalent
 * @param {*} app - Source application name
 * @returns {{ valid: boolean, error?: string, severity?: number, app?: string, message?: string }}
 */
function validateEventInput (payload, severity, app) {
  if (payload === null || payload === undefined || payload === '') {
    return { valid: false, error: 'Message payload is required' }
  }

  if (!app || String(app).trim() === '') {
    return { valid: false, error: 'App name is required' }
  }

  let severityNum
  if (typeof severity === 'string') {
    const severityMap = { warning: 0, critical: 1, info: 2, information: 2 }
    const parsed = parseInt(severity, 10)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= MAX_SEVERITY) {
      severityNum = parsed
    } else if (severity.toLowerCase() in severityMap) {
      severityNum = severityMap[severity.toLowerCase()]
    } else {
      return { valid: false, error: SEVERITY_ERROR }
    }
  } else if (typeof severity === 'number') {
    if (!Number.isInteger(severity) || severity < 0 || severity > MAX_SEVERITY) {
      return { valid: false, error: SEVERITY_ERROR }
    }
    severityNum = severity
  } else {
    return { valid: false, error: SEVERITY_ERROR }
  }

  return {
    valid: true,
    severity: severityNum,
    app: String(app).trim(),
    message: String(payload)
  }
}

module.exports = { formatEvent, validateEventInput }
