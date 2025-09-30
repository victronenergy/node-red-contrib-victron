const { mapCacheToJsonResponse, mapCacheValueToJsonResponseValue } = require('../src/services/utils');

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

})
