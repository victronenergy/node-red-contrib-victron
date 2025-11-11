const { mapCacheToJsonResponse, mapCacheValueToJsonResponseValue, validateVirtualDevicePayload, validateLightControls, debounce, throttle } = require('../src/services/utils');

describe('utils', () => {

  describe('mapCacheToJsonResponse', () => {

    it('should map a simple cache correctly', () => {
      const cache = {
        'com.some.device': {
          '/DeviceInstance': 123,
          '/ProductName': 'Victron Device',
        }
      };

      const expected = JSON.stringify({
        'com.some.device': {
          '/DeviceInstance': 123,
          '/ProductName': 'Victron Device',
        }
      });

      const result = mapCacheToJsonResponse(cache);
      expect(result).toEqual(expected);
    });

    it('handles an empty cache', () => {
      const cache = {};
      const expected = JSON.stringify({});
      const result = mapCacheToJsonResponse(cache);
      expect(result).toEqual(expected);
    });

    it('handles some values (other than string, boolean, number) special by stringifying them', () => {

      const cache = {
        'com.some.device': {
          '/SomeArray': [1, 2, 3],
          '/SomeObject': { key: 'value' },
          '/NormalValue': 'test',
          '/SomeBoolean': true,
          '/SomeNumber': 42,
          '/SomeNull': null,
          '/SomeDate': new Date(2024, 0, 1),  // Dates are objects, so will be iso-formatted
        }
      };

      const expected = JSON.stringify({
        'com.some.device': {
          '/SomeArray': '[1,2,3]',
          '/SomeObject': '{"key":"value"}',
          '/NormalValue': 'test',
          '/SomeBoolean': true,
          '/SomeNumber': 42,
          '/SomeNull': null,
          '/SomeDate': (new Date(2024, 0, 1)).toISOString(),
        }
      });

      const result = mapCacheToJsonResponse(cache);
      expect(result).toEqual(expected);
    });

  })

  describe('mapCacheValueToJsonResponseValue', () => {

    it('returns strings as-is', () => {
      expect(mapCacheValueToJsonResponseValue('test string')).toBe('test string');
    });

    it('returns numbers as-is', () => {
      expect(mapCacheValueToJsonResponseValue(42)).toBe(42);
      expect(mapCacheValueToJsonResponseValue(3.14)).toBe(3.14);
    });

    it('returns booleans as-is', () => {
      expect(mapCacheValueToJsonResponseValue(true)).toBe(true);
      expect(mapCacheValueToJsonResponseValue(false)).toBe(false);
    });

    it('returns null as-is', () => {
      expect(mapCacheValueToJsonResponseValue(null)).toBeNull();
    });

    it('stringifies arrays', () => {
      expect(mapCacheValueToJsonResponseValue([1, 2, 3])).toBe('[1,2,3]');
      expect(mapCacheValueToJsonResponseValue(['a', 'b', 'c'])).toBe('["a","b","c"]');
    });

    it('stringifies objects', () => {
      expect(mapCacheValueToJsonResponseValue({ key: 'value' })).toBe('{"key":"value"}');
      expect(mapCacheValueToJsonResponseValue({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
    });

    it('stringifies dates to ISO format', () => {
      const date = new Date(2024, 0, 1);
      expect(mapCacheValueToJsonResponseValue(date)).toBe(date.toISOString());
    });

    it('stringifies other types (e.g., functions) to their string representation', () => {
      const func = function() { return 'test'; };
      expect(mapCacheValueToJsonResponseValue(func)).toBe(func.toString());
    });

  })

  describe('validateVirtualDevicePayload', () => {

    it('accepts valid object with strings, numbers, booleans, and null', () => {
      const payload = {
        Soc: 75,
        Connected: true,
        CustomId: 'my-battery',
        OptionalField: null
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.invalidKeys).toBeUndefined()
    })

    it('accepts array of numbers (for LightControls)', () => {
      const payload = {
        'SwitchableOutput/output_1/LightControls': [120, 100, 50, 0, 0]
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(true)
    })

    it('accepts mixed valid types including arrays', () => {
      const payload = {
        Soc: 75,
        Connected: true,
        CustomId: 'battery-1',
        'SwitchableOutput/output_1/LightControls': [120, 100, 50, 0, 0],
        OptionalValue: null
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(true)
    })

    it('accepts empty array of numbers', () => {
      const payload = {
        SomeArray: []
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(true)
    })

    it('accepts array with decimals', () => {
      const payload = {
        Values: [1.5, 2.7, 3.14]
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(true)
    })

    it('rejects array with non-numeric values', () => {
      const payload = {
        'SwitchableOutput/output_1/LightControls': [120, 'red', 50]
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid value types')
      expect(result.invalidKeys).toEqual(['SwitchableOutput/output_1/LightControls'])
    })

    it('rejects array with mixed types', () => {
      const payload = {
        BadArray: [1, true, 'string', null]
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(false)
      expect(result.invalidKeys).toEqual(['BadArray'])
    })

    it('rejects payload that is not an object (string)', () => {
      const result = validateVirtualDevicePayload('not an object')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid payload type: string')
    })

    it('rejects payload that is not an object (number)', () => {
      const result = validateVirtualDevicePayload(123)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid payload type: number')
    })

    it('rejects payload that is an array', () => {
      const result = validateVirtualDevicePayload([1, 2, 3])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid payload type: array')
    })

    it('rejects null payload', () => {
      const result = validateVirtualDevicePayload(null)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid payload type')
    })

    it('rejects empty object', () => {
      const result = validateVirtualDevicePayload({})
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty object')
    })

    it('rejects object with invalid value types (object)', () => {
      const payload = {
        Soc: 75,
        InvalidObject: { nested: 'value' }
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid value types')
      expect(result.invalidKeys).toEqual(['InvalidObject'])
    })

    it('rejects object with invalid value types (function)', () => {
      const payload = {
        Soc: 75,
        InvalidFunction: function() { return 'test' }
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(false)
      expect(result.invalidKeys).toEqual(['InvalidFunction'])
    })

    it('rejects object with invalid value types (Date)', () => {
      const payload = {
        Soc: 75,
        InvalidDate: new Date()
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(false)
      expect(result.invalidKeys).toEqual(['InvalidDate'])
    })

    it('rejects multiple invalid keys and reports them all', () => {
      const payload = {
        Soc: 75, // valid
        BadObject: { nested: 'value' }, // invalid
        Connected: true, // valid
        BadArray: [1, 'string'], // invalid
        BadDate: new Date() // invalid
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.valid).toBe(false)
      expect(result.invalidKeys).toHaveLength(3)
      expect(result.invalidKeys).toContain('BadObject')
      expect(result.invalidKeys).toContain('BadArray')
      expect(result.invalidKeys).toContain('BadDate')
    })

    it('provides helpful error message for invalid keys', () => {
      const payload = {
        Soc: 75,
        BadObject: { nested: 'value' }
      }
      const result = validateVirtualDevicePayload(payload)
      expect(result.error).toContain('BadObject')
      expect(result.error).toContain('Expected: string, number, boolean, null, or array of numbers')
    })

  })

  describe('validateLightControls', () => {

    it('accepts valid LightControls array with all zeros', () => {
      const result = validateLightControls([0, 0, 0, 0, 0])
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('accepts valid LightControls with typical RGB values', () => {
      const result = validateLightControls([120, 100, 50, 0, 0])
      expect(result.valid).toBe(true)
    })

    it('accepts valid LightControls with max values', () => {
      const result = validateLightControls([360, 100, 100, 100, 6500])
      expect(result.valid).toBe(true)
    })

    it('accepts valid LightControls with CCT values', () => {
      const result = validateLightControls([0, 0, 75, 0, 2700])
      expect(result.valid).toBe(true)
    })

    it('accepts valid LightControls with RGB+W values', () => {
      const result = validateLightControls([240, 80, 60, 40, 0])
      expect(result.valid).toBe(true)
    })

    it('rejects non-array value (string)', () => {
      const result = validateLightControls('not an array')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('must be an array')
    })

    it('rejects non-array value (object)', () => {
      const result = validateLightControls({ hue: 120 })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('must be an array')
    })

    it('rejects array with too few elements', () => {
      const result = validateLightControls([120, 100])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exactly 5 elements')
      expect(result.error).toContain('got 2')
    })

    it('rejects array with too many elements', () => {
      const result = validateLightControls([120, 100, 50, 0, 0, 99])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exactly 5 elements')
      expect(result.error).toContain('got 6')
    })

    it('rejects hue above 360', () => {
      const result = validateLightControls([380, 100, 50, 0, 0])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Hue[0]=380')
      expect(result.error).toContain('valid range: 0-360')
    })

    it('rejects negative hue', () => {
      const result = validateLightControls([-10, 100, 50, 0, 0])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Hue[0]=-10')
    })

    it('rejects saturation above 100', () => {
      const result = validateLightControls([120, 150, 50, 0, 0])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Saturation[1]=150')
      expect(result.error).toContain('valid range: 0-100')
    })

    it('rejects brightness above 100', () => {
      const result = validateLightControls([120, 100, 200, 0, 0])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Brightness[2]=200')
    })

    it('rejects white above 100', () => {
      const result = validateLightControls([120, 100, 50, 150, 0])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('White[3]=150')
    })

    it('rejects color temperature above 6500', () => {
      const result = validateLightControls([0, 0, 75, 0, 7000])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('ColorTemperature[4]=7000')
      expect(result.error).toContain('valid range: 0-6500')
    })

    it('rejects non-integer values (floats)', () => {
      const result = validateLightControls([120.5, 100, 50, 0, 0])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Hue[0]=120.5')
    })

    it('rejects non-numeric values (strings)', () => {
      const result = validateLightControls([120, '100', 50, 0, 0])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Saturation[1]=100')
    })

    it('reports all invalid elements', () => {
      const result = validateLightControls([380, 150, 50, 0, 0])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Hue[0]=380')
      expect(result.error).toContain('Saturation[1]=150')
    })

    it('reports multiple out-of-range values', () => {
      const result = validateLightControls([380, 150, 200, 120, 7000])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Hue[0]=380')
      expect(result.error).toContain('Saturation[1]=150')
      expect(result.error).toContain('Brightness[2]=200')
      expect(result.error).toContain('White[3]=120')
      expect(result.error).toContain('ColorTemperature[4]=7000')
    })

  })

  describe('throttle', () => {

    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('calls the function at most once during the throttle period, executing with the most recent arguments when the interval expires', () => {
      const func = jest.fn()
      const throttled = throttle(func, 1000)

      throttled(1) // first call at t + 0ms
      jest.advanceTimersByTime(900)
      expect(func).toHaveBeenCalledTimes(0)

      throttled(2)
      expect(func).toHaveBeenCalledTimes(0)

      jest.advanceTimersByTime(50) // t + 950ms
      expect(func).toHaveBeenCalledTimes(0)

      jest.advanceTimersByTime(50) // t + 1000ms
      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(2)

      throttled(3)
      jest.advanceTimersByTime(1000) // t + 2000ms
      expect(func).toHaveBeenCalledTimes(2)
      expect(func).toHaveBeenCalledWith(3)
    })

  })

  describe('debounce', () => {

    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('delays function execution until after the specified delay', () => {
      const func = jest.fn()
      const debounced = debounce(func, 300)

      debounced(1)
      expect(func).toHaveBeenCalledTimes(0)

      jest.advanceTimersByTime(200)
      expect(func).toHaveBeenCalledTimes(0)

      jest.advanceTimersByTime(100)
      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(1)
    })

    it('resets the timer on each new call', () => {
      const func = jest.fn()
      const debounced = debounce(func, 300)

      debounced(1)
      jest.advanceTimersByTime(150)

      debounced(2)
      jest.advanceTimersByTime(150)

      expect(func).not.toHaveBeenCalled()

      jest.advanceTimersByTime(150)

      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(2)
    })

    it('uses only the last call\'s arguments', () => {
      const func = jest.fn()
      const debounced = debounce(func, 300)

      debounced(1)
      debounced(2)
      debounced(3)

      jest.advanceTimersByTime(300)

      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(3)
    })

    it('allows subsequent calls after delay expires', () => {
      const func = jest.fn()
      const debounced = debounce(func, 300)

      debounced(1)
      jest.advanceTimersByTime(300)

      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(1)

      debounced(2)
      jest.advanceTimersByTime(300)

      expect(func).toHaveBeenCalledTimes(2)
      expect(func).toHaveBeenCalledWith(2)
    })

    it('preserves this context', () => {
      const context = { value: 42 }
      const func = jest.fn(function () {
        return this.value
      })
      const debounced = debounce(func, 300)

      debounced.call(context)

      jest.advanceTimersByTime(300)

      expect(func).toHaveBeenCalledTimes(1)
      expect(func.mock.instances[0]).toBe(context)
    })

  })

})
