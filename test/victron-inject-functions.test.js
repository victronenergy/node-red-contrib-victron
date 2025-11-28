const { formatNotification, validateNotificationInput } = require('../src/nodes/victron-inject-functions')

describe('victron-inject-functions', () => {
  describe('formatNotification', () => {
    it('should format notification with type, title, and message', () => {
      const result = formatNotification(0, 'Test Title', 'Test Message')
      expect(result).toBe('0\tTest Title\tTest Message')
    })

    it('should format notification with alarm type', () => {
      const result = formatNotification(1, 'Alarm Title', 'Alarm Message')
      expect(result).toBe('1\tAlarm Title\tAlarm Message')
    })

    it('should format notification with information type', () => {
      const result = formatNotification(2, 'Info Title', 'Info Message')
      expect(result).toBe('2\tInfo Title\tInfo Message')
    })

    it('should handle special characters in title and message', () => {
      const result = formatNotification(0, 'Title: Special!', 'Message with "quotes" and \'apostrophes\'')
      expect(result).toBe('0\tTitle: Special!\tMessage with "quotes" and \'apostrophes\'')
    })

    it('should sanitize tab characters in title', () => {
      const result = formatNotification(0, 'Title\twith\ttabs', 'Message')
      expect(result).toBe('0\tTitle with tabs\tMessage')
    })

    it('should sanitize tab characters in message', () => {
      const result = formatNotification(0, 'Title', 'Message\twith\ttabs')
      expect(result).toBe('0\tTitle\tMessage with tabs')
    })

    it('should sanitize newline characters in title', () => {
      const result = formatNotification(0, 'Title\nwith\nnewlines', 'Message')
      expect(result).toBe('0\tTitle with newlines\tMessage')
    })

    it('should sanitize newline characters in message', () => {
      const result = formatNotification(0, 'Title', 'Message\nwith\nnewlines')
      expect(result).toBe('0\tTitle\tMessage with newlines')
    })

    it('should sanitize carriage return characters', () => {
      const result = formatNotification(0, 'Title\r\nCRLF', 'Message\r\nCRLF')
      expect(result).toBe('0\tTitle  CRLF\tMessage  CRLF')
    })

    it('should trim whitespace after sanitization', () => {
      const result = formatNotification(0, '  Title\t  ', '  Message\n  ')
      expect(result).toBe('0\tTitle\tMessage')
    })

    it('should handle empty strings after trimming', () => {
      const result = formatNotification(0, '   ', '   ')
      expect(result).toBe('0\t\t')
    })
  })

  describe('validateNotificationInput', () => {
    describe('valid inputs', () => {
      it('should accept valid string payload with number type', () => {
        const result = validateNotificationInput('Test message', 0, 'Test Title')
        expect(result.valid).toBe(true)
        expect(result.type).toBe(0)
        expect(result.title).toBe('Test Title')
        expect(result.message).toBe('Test message')
      })

      it('should accept valid payload with type as "warning"', () => {
        const result = validateNotificationInput('Warning message', 'warning', 'Warning Title')
        expect(result.valid).toBe(true)
        expect(result.type).toBe(0)
        expect(result.title).toBe('Warning Title')
        expect(result.message).toBe('Warning message')
      })

      it('should accept valid payload with type as "alarm"', () => {
        const result = validateNotificationInput('Alarm message', 'alarm', 'Alarm Title')
        expect(result.valid).toBe(true)
        expect(result.type).toBe(1)
        expect(result.title).toBe('Alarm Title')
        expect(result.message).toBe('Alarm message')
      })

      it('should accept valid payload with type as "information"', () => {
        const result = validateNotificationInput('Info message', 'information', 'Info Title')
        expect(result.valid).toBe(true)
        expect(result.type).toBe(2)
        expect(result.title).toBe('Info Title')
        expect(result.message).toBe('Info message')
      })

      it('should accept valid payload with type as "info"', () => {
        const result = validateNotificationInput('Info message', 'info', 'Info Title')
        expect(result.valid).toBe(true)
        expect(result.type).toBe(2)
        expect(result.title).toBe('Info Title')
        expect(result.message).toBe('Info message')
      })

      it('should handle case-insensitive type strings', () => {
        expect(validateNotificationInput('msg', 'WARNING', 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 'Warning', 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 'ALARM', 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 'Alarm', 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 'INFORMATION', 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 'Information', 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 'INFO', 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 'Info', 'title').valid).toBe(true)
      })

      it('should convert non-string payload to string', () => {
        const result = validateNotificationInput(123, 0, 'Title')
        expect(result.valid).toBe(true)
        expect(result.message).toBe('123')
      })

      it('should convert boolean payload to string', () => {
        const result = validateNotificationInput(true, 0, 'Title')
        expect(result.valid).toBe(true)
        expect(result.message).toBe('true')
      })

      it('should convert object payload to string', () => {
        const result = validateNotificationInput({ key: 'value' }, 0, 'Title')
        expect(result.valid).toBe(true)
        expect(result.message).toBe('[object Object]')
      })

      it('should accept all valid type numbers (0, 1, 2)', () => {
        expect(validateNotificationInput('msg', 0, 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 1, 'title').valid).toBe(true)
        expect(validateNotificationInput('msg', 2, 'title').valid).toBe(true)
      })

      it('should convert title to string', () => {
        const result = validateNotificationInput('Message', 0, 123)
        expect(result.valid).toBe(true)
        expect(result.title).toBe('123')
      })
    })

    describe('invalid inputs - payload', () => {
      it('should reject null payload', () => {
        const result = validateNotificationInput(null, 0, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Message payload is required')
      })

      it('should reject undefined payload', () => {
        const result = validateNotificationInput(undefined, 0, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Message payload is required')
      })

      it('should reject empty string payload', () => {
        const result = validateNotificationInput('', 0, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Message payload is required')
      })

      it('should reject message longer than 500 characters', () => {
        const longMessage = 'a'.repeat(501)
        const result = validateNotificationInput(longMessage, 0, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Message too long (max 500 chars)')
      })

      it('should accept message exactly 500 characters', () => {
        const maxMessage = 'a'.repeat(500)
        const result = validateNotificationInput(maxMessage, 0, 'Title')
        expect(result.valid).toBe(true)
      })
    })

    describe('invalid inputs - title', () => {
      it('should reject empty title', () => {
        const result = validateNotificationInput('Message', 0, '')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Notification title is required')
      })

      it('should reject null title', () => {
        const result = validateNotificationInput('Message', 0, null)
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Notification title is required')
      })

      it('should reject undefined title', () => {
        const result = validateNotificationInput('Message', 0, undefined)
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Notification title is required')
      })

      it('should reject title longer than 100 characters', () => {
        const longTitle = 'a'.repeat(101)
        const result = validateNotificationInput('Message', 0, longTitle)
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Title too long (max 100 chars)')
      })

      it('should accept title exactly 100 characters', () => {
        const maxTitle = 'a'.repeat(100)
        const result = validateNotificationInput('Message', 0, maxTitle)
        expect(result.valid).toBe(true)
      })
    })

    describe('invalid inputs - type', () => {
      it('should reject type number less than 0', () => {
        const result = validateNotificationInput('Message', -1, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })

      it('should reject type number greater than 2', () => {
        const result = validateNotificationInput('Message', 3, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })

      it('should reject invalid type string', () => {
        const result = validateNotificationInput('Message', 'invalid', 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })

      it('should reject type as NaN string', () => {
        const result = validateNotificationInput('Message', 'notanumber', 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })

      it('should reject type as null', () => {
        const result = validateNotificationInput('Message', null, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })

      it('should reject type as undefined', () => {
        const result = validateNotificationInput('Message', undefined, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })

      it('should reject type as object', () => {
        const result = validateNotificationInput('Message', {}, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })

      it('should reject type as array', () => {
        const result = validateNotificationInput('Message', [], 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })

      it('should reject decimal type number', () => {
        const result = validateNotificationInput('Message', 1.5, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Type must be "warning", "alarm", "info"/"information", or 0-2')
      })
    })

    describe('edge cases', () => {
      it('should reject very long message', () => {
        const longMessage = 'a'.repeat(10000)
        const result = validateNotificationInput(longMessage, 0, 'Title')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Message too long (max 500 chars)')
      })

      it('should reject very long title', () => {
        const longTitle = 'Title '.repeat(1000)
        const result = validateNotificationInput('Message', 0, longTitle)
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Title too long (max 100 chars)')
      })

      it('should handle special unicode characters', () => {
        const result = validateNotificationInput('🔋 Battery low', 0, '⚠️ Warning')
        expect(result.valid).toBe(true)
        expect(result.message).toBe('🔋 Battery low')
        expect(result.title).toBe('⚠️ Warning')
      })

      it('should handle newlines in message', () => {
        const result = validateNotificationInput('Line 1\nLine 2', 0, 'Title')
        expect(result.valid).toBe(true)
        expect(result.message).toBe('Line 1\nLine 2')
      })

      it('should handle tabs in message and title', () => {
        const result = validateNotificationInput('Message\twith\ttabs', 0, 'Title\twith\ttab')
        expect(result.valid).toBe(true)
        expect(result.message).toBe('Message\twith\ttabs')
        expect(result.title).toBe('Title\twith\ttab')
      })
    })
  })
})
