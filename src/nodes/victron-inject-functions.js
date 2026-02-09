/**
 * Format notification string for dbus injection
 * @param {number} type - Notification type (0=Warning, 1=Alarm, 2=Information)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @returns {string} Formatted notification string "type\ttitle\tmessage"
 */
function formatNotification (type, title, message) {
  const sanitizedTitle = String(title)
    .replace(/\t/g, ' ')
    .replace(/[\r\n]/g, ' ')
    .trim()

  const sanitizedMessage = String(message)
    .replace(/\t/g, ' ')
    .replace(/[\r\n]/g, ' ')
    .trim()

  return `${type}\t${sanitizedTitle}\t${sanitizedMessage}`
}

/**
 * Validate notification input parameters
 * @param {*} payload - The message payload
 * @param {*} type - The notification type (number 0-2 or string "warning"/"alarm"/"information"/"info")
 * @param {*} title - The notification title
 * @returns {object} Validation result with valid flag and error/data
 */
function validateNotificationInput (payload, type, title) {
  if (payload === null || payload === undefined || payload === '') {
    return {
      valid: false,
      error: 'Message payload is required'
    }
  }

  const message = String(payload)

  if (!title || title === '') {
    return {
      valid: false,
      error: 'Notification title is required'
    }
  }

  const MAX_TITLE_LENGTH = 100
  const MAX_MESSAGE_LENGTH = 500
  const TYPE_ERROR = 'Type must be "warning", "alarm", "info"/"information", or 0-2'

  const truncatedTitle = String(title).substring(0, MAX_TITLE_LENGTH)
  const truncatedMessage = message.substring(0, MAX_MESSAGE_LENGTH)

  let typeNum
  if (typeof type === 'string') {
    const typeMap = {
      warning: 0,
      alarm: 1,
      information: 2,
      info: 2
    }
    const typeLower = type.toLowerCase()

    // Check if the string is a number between 0 and 2
    const parsedType = parseInt(type, 10)
    if (!isNaN(parsedType) && parsedType >= 0 && parsedType <= 2) {
      typeNum = parsedType
    } else if (typeLower in typeMap) {
      typeNum = typeMap[typeLower]
    } else {
      return {
        valid: false,
        error: TYPE_ERROR
      }
    }
  } else if (typeof type === 'number') {
    if (!Number.isInteger(type) || type < 0 || type > 2) {
      return {
        valid: false,
        error: TYPE_ERROR
      }
    }
    typeNum = type
  } else {
    return {
      valid: false,
      error: TYPE_ERROR
    }
  }

  return {
    valid: true,
    type: typeNum,
    title: truncatedTitle,
    message: truncatedMessage
  }
}

module.exports = {
  formatNotification,
  validateNotificationInput
}
