const { hsbToRgb } = require('../src/services/color-utils')

describe('Color Utils', () => {
  describe('hsbToRgb', () => {
    test('converts pure red (H=0, S=100, B=100)', () => {
      expect(hsbToRgb(0, 100, 100)).toBe('#ff0000')
    })

    test('converts pure green (H=120, S=100, B=100)', () => {
      expect(hsbToRgb(120, 100, 100)).toBe('#00ff00')
    })

    test('converts pure blue (H=240, S=100, B=100)', () => {
      expect(hsbToRgb(240, 100, 100)).toBe('#0000ff')
    })

    test('converts white (H=0, S=0, B=100)', () => {
      expect(hsbToRgb(0, 0, 100)).toBe('#ffffff')
    })

    test('converts black (H=0, S=0, B=0)', () => {
      expect(hsbToRgb(0, 0, 0)).toBe('#000000')
    })

    test('converts gray (H=0, S=0, B=50)', () => {
      expect(hsbToRgb(0, 0, 50)).toBe('#808080')
    })

    test('handles hue wraparound (H=360 = H=0)', () => {
      expect(hsbToRgb(360, 100, 100)).toBe('#ff0000')
    })

    test('handles hue > 360 with modulo', () => {
      expect(hsbToRgb(480, 100, 100)).toBe('#00ff00') // 480 % 360 = 120
    })

    test('clamps saturation above 100', () => {
      expect(hsbToRgb(0, 150, 100)).toBe('#ff0000')
    })

    test('clamps brightness above 100', () => {
      expect(hsbToRgb(0, 100, 150)).toBe('#ff0000')
    })

    test('clamps saturation below 0', () => {
      expect(hsbToRgb(0, -50, 100)).toBe('#ffffff')
    })

    test('clamps brightness below 0', () => {
      expect(hsbToRgb(0, 100, -50)).toBe('#000000')
    })

    test('converts orange (H=30, S=100, B=100)', () => {
      expect(hsbToRgb(30, 100, 100)).toBe('#ff8000')
    })

    test('converts cyan (H=180, S=100, B=100)', () => {
      expect(hsbToRgb(180, 100, 100)).toBe('#00ffff')
    })

    test('converts desaturated color (H=120, S=50, B=100)', () => {
      expect(hsbToRgb(120, 50, 100)).toBe('#80ff80')
    })
  })
})
