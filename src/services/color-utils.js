/**
 * Color conversion utilities for RGB lighting controls
 */

/**
 * Convert HSB (Hue, Saturation, Brightness) to RGB hex string
 * @param {number} h - Hue (0-360 degrees)
 * @param {number} s - Saturation (0-100%)
 * @param {number} b - Brightness (0-100%)
 * @returns {string} RGB color in #RRGGBB format
 */
function hsbToRgb (h, s, b) {
  // Normalize values
  h = h % 360
  s = Math.max(0, Math.min(100, s)) / 100
  b = Math.max(0, Math.min(100, b)) / 100

  const c = b * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = b - c

  let r, g, blue
  if (h < 60) {
    [r, g, blue] = [c, x, 0]
  } else if (h < 120) {
    [r, g, blue] = [x, c, 0]
  } else if (h < 180) {
    [r, g, blue] = [0, c, x]
  } else if (h < 240) {
    [r, g, blue] = [0, x, c]
  } else if (h < 300) {
    [r, g, blue] = [x, 0, c]
  } else {
    [r, g, blue] = [c, 0, x]
  }

  const red = Math.round((r + m) * 255)
  const green = Math.round((g + m) * 255)
  const blueVal = Math.round((blue + m) * 255)

  return '#' + [red, green, blueVal].map(v => v.toString(16).padStart(2, '0')).join('')
}

module.exports = {
  hsbToRgb
}
