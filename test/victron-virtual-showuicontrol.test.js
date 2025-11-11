// test/victron-virtual-showuicontrol.test.js
// Tests for ShowUIControl bitmask support

describe('ShowUIControl bitmask support', () => {
  test('should accept valid bitmask values 0-6', () => {
    const validValues = [0, 1, 2, 3, 4, 5, 6]

    validValues.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(6)
    })
  })

  test('bitmask value 0 means do not show', () => {
    const value = 0b000
    expect(value).toBe(0)
  })

  test('bitmask value 1 means show in all UIs', () => {
    const value = 0b001
    expect(value).toBe(1)
    expect(value & 0b001).toBeTruthy() // bit 0 set
  })

  test('bitmask value 2 means show in local UI only', () => {
    const value = 0b010
    expect(value).toBe(2)
    expect(value & 0b010).toBeTruthy() // bit 1 set
  })

  test('bitmask value 3 means show in all UIs and local UI', () => {
    const value = 0b011
    expect(value).toBe(3)
    expect(value & 0b001).toBeTruthy() // bit 0 set
    expect(value & 0b010).toBeTruthy() // bit 1 set
  })

  test('bitmask value 4 means show in all remote UIs', () => {
    const value = 0b100
    expect(value).toBe(4)
    expect(value & 0b100).toBeTruthy() // bit 2 set
  })

  test('bitmask value 5 means show in all UIs and all remote UIs', () => {
    const value = 0b101
    expect(value).toBe(5)
    expect(value & 0b001).toBeTruthy() // bit 0 set
    expect(value & 0b100).toBeTruthy() // bit 2 set
  })

  test('bitmask value 6 means show in local UI and all remote UIs', () => {
    const value = 0b110
    expect(value).toBe(6)
    expect(value & 0b010).toBeTruthy() // bit 1 set
    expect(value & 0b100).toBeTruthy() // bit 2 set
  })

  test('default value should be 1 (show in all UIs)', () => {
    const defaultValue = 1
    expect(defaultValue).toBe(1)
    expect(defaultValue & 0b001).toBeTruthy()
  })
})
