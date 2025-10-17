// test/victron-virtual-switch-rgb.test.js
const { SWITCH_TYPE_MAP, SWITCH_TYPE_CONFIG } = require('../src/nodes/victron-virtual-constants.js');
const { validateRgbConfig } = require('./fixtures/victron-virtual-functions.cjs');

describe('RGB CCT Control Switch Configuration', () => {
  describe('Field Configuration', () => {
    test('should include RGB color wheel checkbox field', () => {
      const config = SWITCH_TYPE_CONFIG[SWITCH_TYPE_MAP.RGB_CCT_CONTROL];
      const rgbField = config.fields.find(f => f.name === 'enableRgbWheel');
      
      expect(rgbField).toBeDefined();
      expect(rgbField.type).toBe('checkbox');
      expect(rgbField.label).toBe('RGB color wheel');
      expect(rgbField.default).toBe(true);
    });

    test('should include White dimmer checkbox field', () => {
      const config = SWITCH_TYPE_CONFIG[SWITCH_TYPE_MAP.RGB_CCT_CONTROL];
      const whiteField = config.fields.find(f => f.name === 'enableWhiteDimmer');
      
      expect(whiteField).toBeDefined();
      expect(whiteField.type).toBe('checkbox');
      expect(whiteField.label).toBe('White dimmer');
      expect(whiteField.default).toBe(false);
    });

    test('should include CCT wheel checkbox field', () => {
      const config = SWITCH_TYPE_CONFIG[SWITCH_TYPE_MAP.RGB_CCT_CONTROL];
      const cctField = config.fields.find(f => f.name === 'enableCctWheel');
      
      expect(cctField).toBeDefined();
      expect(cctField.type).toBe('checkbox');
      expect(cctField.label).toBe('CCT wheel');
      expect(cctField.default).toBe(false);
    });
  });

  describe('Validation', () => {
    test('should reject when all controls are disabled', () => {
      expect(validateRgbConfig({ 
        enableRgbWheel: false, 
        enableWhiteDimmer: false, 
        enableCctWheel: false 
      })).toBe(false);
    });

    test('should accept when only RGB wheel is enabled', () => {
      expect(validateRgbConfig({ 
        enableRgbWheel: true, 
        enableWhiteDimmer: false, 
        enableCctWheel: false 
      })).toBe(true);
    });

    test('should accept when only White dimmer is enabled', () => {
      expect(validateRgbConfig({ 
        enableRgbWheel: false, 
        enableWhiteDimmer: true, 
        enableCctWheel: false 
      })).toBe(true);
    });

    test('should accept when all controls are enabled', () => {
      expect(validateRgbConfig({ 
        enableRgbWheel: true, 
        enableWhiteDimmer: true, 
        enableCctWheel: true 
      })).toBe(true);
    });

    test('should return validation message when requested and all disabled', () => {
      const result = validateRgbConfig({ 
        enableRgbWheel: false, 
        enableWhiteDimmer: false, 
        enableCctWheel: false 
      }, true);
      
      expect(result).toBe('At least one control type must be enabled');
    });
  });
});
