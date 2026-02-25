// test/victron-virtual-device-type-init.test.js
/* eslint-env jest */

const acload = require('../src/nodes/victron-virtual/device-type/acload')
const battery = require('../src/nodes/victron-virtual/device-type/battery')
const generator = require('../src/nodes/victron-virtual/device-type/generator')
const gps = require('../src/nodes/victron-virtual/device-type/gps')
const grid = require('../src/nodes/victron-virtual/device-type/grid')
const meteo = require('../src/nodes/victron-virtual/device-type/meteo')
const motordrive = require('../src/nodes/victron-virtual/device-type/motordrive')
const pvinverter = require('../src/nodes/victron-virtual/device-type/pvinverter')
const switchMod = require('../src/nodes/victron-virtual/device-type/switch')
const tank = require('../src/nodes/victron-virtual/device-type/tank')
const temperature = require('../src/nodes/victron-virtual/device-type/temperature')

function makeFixtures () {
  return {
    ifaceDesc: { properties: {} },
    iface: {},
    node: { error: jest.fn() }
  }
}

// ---------------------------------------------------------------------------
// acload
// ---------------------------------------------------------------------------

describe('acload', () => {
  describe('initialize', () => {
    test('adds L1 phase properties for 1-phase', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = acload.initialize({ acload_nrofphases: 1 }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L2/Current']).toBeUndefined()
      expect(result).toBe('Virtual 1-phase AC load')
    })

    test('adds L1-L3 phase properties for 3-phase', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      acload.initialize({ acload_nrofphases: 3 }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L2/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L3/Current']).toBeDefined()
    })

    test('sets default values when enabled', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      acload.initialize({ acload_nrofphases: 1, default_values: true }, ifaceDesc, iface, node)
      expect(iface['Ac/Power']).toBe(0)
      expect(iface['Ac/Energy/Forward']).toBe(0)
      expect(iface['Ac/Energy/Reverse']).toBe(0)
    })

    test('does not set default values when disabled', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      acload.initialize({ acload_nrofphases: 1, default_values: false }, ifaceDesc, iface, node)
      expect(iface['Ac/Power']).toBeUndefined()
    })
  })
})

// ---------------------------------------------------------------------------
// battery
// ---------------------------------------------------------------------------

describe('battery', () => {
  describe('initialize', () => {
    test('sets Capacity from config', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      battery.initialize({ battery_capacity: 100 }, ifaceDesc, iface, node)
      expect(iface.Capacity).toBe(100)
    })

    test('ignores non-numeric battery_capacity', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      battery.initialize({ battery_capacity: 'invalid' }, ifaceDesc, iface, node)
      expect(iface.Capacity).toBeUndefined()
    })

    test('uses 12V preset', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      battery.initialize({ default_values: true, battery_voltage_preset: '12' }, ifaceDesc, iface, node)
      expect(iface['Dc/0/Voltage']).toBe(12)
    })

    test('uses 48V preset', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      battery.initialize({ default_values: true, battery_voltage_preset: '48' }, ifaceDesc, iface, node)
      expect(iface['Dc/0/Voltage']).toBe(48)
    })

    test('uses custom voltage', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      battery.initialize({ default_values: true, battery_voltage_preset: 'custom', battery_voltage_custom: 36 }, ifaceDesc, iface, node)
      expect(iface['Dc/0/Voltage']).toBe(36)
    })

    test('falls back to 24V when custom voltage is empty', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      battery.initialize({ default_values: true, battery_voltage_preset: 'custom', battery_voltage_custom: '' }, ifaceDesc, iface, node)
      expect(iface['Dc/0/Voltage']).toBe(24)
    })

    test('falls back to 24V for unknown preset', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      battery.initialize({ default_values: true, battery_voltage_preset: 'unknown' }, ifaceDesc, iface, node)
      expect(iface['Dc/0/Voltage']).toBe(24)
    })

    test('removes temperature properties when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Dc/0/Temperature'] = {}
      iface['Dc/0/Temperature'] = 25
      battery.initialize({ include_battery_temperature: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Dc/0/Temperature']).toBeUndefined()
      expect(iface['Dc/0/Temperature']).toBeUndefined()
    })

    test('keeps temperature properties when included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Dc/0/Temperature'] = {}
      iface['Dc/0/Temperature'] = 25
      battery.initialize({ include_battery_temperature: true }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Dc/0/Temperature']).toBeDefined()
    })

    test('returns capacity in status text', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = battery.initialize({ battery_capacity: 25 }, ifaceDesc, iface, node)
      expect(result).toBe('Virtual 25Ah battery')
    })
  })
})

// ---------------------------------------------------------------------------
// generator
// ---------------------------------------------------------------------------

describe('generator', () => {
  describe('initialize', () => {
    test('AC 1-phase adds L1 properties and sets NrOfPhases', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      acload.initialize({ acload_nrofphases: 1 }, ifaceDesc, iface, node)
      const { ifaceDesc: gIfaceDesc, iface: gIface, node: gNode } = makeFixtures()
      generator.initialize({ generator_type: 'ac', generator_nrofphases: 1 }, gIfaceDesc, gIface, gNode)
      expect(gIfaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(gIfaceDesc.properties['Ac/L2/Current']).toBeUndefined()
      expect(gIface.NrOfPhases).toBe(1)
    })

    test('AC 3-phase adds L1-L3 properties', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      generator.initialize({ generator_type: 'ac', generator_nrofphases: 3 }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L2/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L3/Current']).toBeDefined()
    })

    test('DC generator does not add AC phase properties', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      generator.initialize({ generator_type: 'dc' }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeUndefined()
    })

    test('removes OperatingHours when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Engine/OperatingHours'] = {}
      iface['Engine/OperatingHours'] = 0
      generator.initialize({ generator_type: 'ac', include_engine_hours: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Engine/OperatingHours']).toBeUndefined()
    })

    test('keeps OperatingHours when included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Engine/OperatingHours'] = {}
      generator.initialize({ generator_type: 'ac', include_engine_hours: true }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Engine/OperatingHours']).toBeDefined()
    })

    test('removes StarterVoltage and related alarms when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties.StarterVoltage = {}
      ifaceDesc.properties['Alarms/LowStarterVoltage'] = {}
      ifaceDesc.properties['Alarms/HighStarterVoltage'] = {}
      generator.initialize({ generator_type: 'ac', include_starter_voltage: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties.StarterVoltage).toBeUndefined()
      expect(ifaceDesc.properties['Alarms/LowStarterVoltage']).toBeUndefined()
      expect(ifaceDesc.properties['Alarms/HighStarterVoltage']).toBeUndefined()
    })

    test('removes History/EnergyOut for DC when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['History/EnergyOut'] = {}
      iface['History/EnergyOut'] = 0
      generator.initialize({ generator_type: 'dc', include_history_energy: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['History/EnergyOut']).toBeUndefined()
    })

    test('sets DC default values', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      generator.initialize({ generator_type: 'dc', default_values: true, include_history_energy: true }, ifaceDesc, iface, node)
      expect(iface['Dc/0/Current']).toBe(0)
      expect(iface['Dc/0/Voltage']).toBe(48)
      expect(iface['History/EnergyOut']).toBe(0)
    })

    test('sets AC default values', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      generator.initialize({ generator_type: 'ac', generator_nrofphases: 1, default_values: true, include_engine_hours: true, include_starter_voltage: true }, ifaceDesc, iface, node)
      expect(iface['Ac/Power']).toBe(0)
      expect(iface['Engine/OperatingHours']).toBe(0)
      expect(iface.StarterVoltage).toBe(12)
    })

    test('returns AC generator label', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = generator.initialize({ generator_type: 'ac', generator_nrofphases: 1 }, ifaceDesc, iface, node)
      expect(result).toBe('Virtual 1-phase AC generator')
    })

    test('returns DC generator label', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = generator.initialize({ generator_type: 'dc' }, ifaceDesc, iface, node)
      expect(result).toBe('Virtual DC generator')
    })
  })

  describe('format', () => {
    const fmt = generator.properties.genset.StatusCode.format
    test.each([
      [0, 'Standby'],
      [8, 'Running'],
      [9, 'Cooldown'],
      [11, 'Error'],
      [99, 'unknown']
    ])('StatusCode %i → %s', (v, expected) => {
      expect(fmt(v)).toBe(expected)
    })

    test('dcgenset State: 0→Stopped, 1→Running, unknown→unknown', () => {
      const stateFmt = generator.properties.dcgenset.State.format
      expect(stateFmt(0)).toBe('Stopped')
      expect(stateFmt(1)).toBe('Running')
      expect(stateFmt(99)).toBe('unknown')
    })
  })
})

// ---------------------------------------------------------------------------
// gps
// ---------------------------------------------------------------------------

describe('gps', () => {
  test('initialize is a no-op and returns undefined', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    const result = gps.initialize({}, ifaceDesc, iface, node)
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// grid
// ---------------------------------------------------------------------------

describe('grid', () => {
  describe('initialize', () => {
    test('1-phase adds L1 properties and sets NrOfPhases=1', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = grid.initialize({ grid_nrofphases: 1 }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L2/Current']).toBeUndefined()
      expect(iface.NrOfPhases).toBe(1)
      expect(result).toBe('Virtual 1-phase grid meter')
    })

    test('3-phase adds L1-L3 properties', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      grid.initialize({ grid_nrofphases: 3 }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L2/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L3/Current']).toBeDefined()
    })

    test('sets default values when enabled', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      grid.initialize({ grid_nrofphases: 1, default_values: true }, ifaceDesc, iface, node)
      expect(iface['Ac/Power']).toBe(0)
      expect(iface['Ac/Frequency']).toBe(50)
      expect(iface['Ac/N/Current']).toBe(0)
    })
  })
})

// ---------------------------------------------------------------------------
// meteo
// ---------------------------------------------------------------------------

describe('meteo', () => {
  describe('initialize', () => {
    test('sets Irradiance and WindSpeed to 0 with default_values', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      meteo.initialize({ default_values: true }, ifaceDesc, iface, node)
      expect(iface.Irradiance).toBe(0)
      expect(iface.WindSpeed).toBe(0)
    })

    test('does not set values without default_values', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      meteo.initialize({ default_values: false }, ifaceDesc, iface, node)
      expect(iface.Irradiance).toBeUndefined()
    })

    test('returns undefined', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      expect(meteo.initialize({}, ifaceDesc, iface, node)).toBeUndefined()
    })
  })
})

// ---------------------------------------------------------------------------
// motordrive
// ---------------------------------------------------------------------------

describe('motordrive', () => {
  describe('initialize', () => {
    test('removes Motor/Temperature when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Motor/Temperature'] = {}
      iface['Motor/Temperature'] = null
      motordrive.initialize({ include_motor_temp: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Motor/Temperature']).toBeUndefined()
      expect(iface['Motor/Temperature']).toBeUndefined()
    })

    test('removes Controller/Temperature when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Controller/Temperature'] = {}
      motordrive.initialize({ include_controller_temp: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Controller/Temperature']).toBeUndefined()
    })

    test('removes Coolant/Temperature when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Coolant/Temperature'] = {}
      motordrive.initialize({ include_coolant_temp: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Coolant/Temperature']).toBeUndefined()
    })

    test('removes Motor/RPM when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Motor/RPM'] = {}
      motordrive.initialize({ include_motor_rpm: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Motor/RPM']).toBeUndefined()
    })

    test('removes Motor/Direction when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties['Motor/Direction'] = {}
      motordrive.initialize({ include_motor_direction: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Motor/Direction']).toBeUndefined()
    })

    test('sets default values including optional fields when enabled', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      motordrive.initialize({
        default_values: true,
        include_motor_temp: true,
        include_controller_temp: true,
        include_coolant_temp: true,
        include_motor_rpm: true,
        include_motor_direction: true
      }, ifaceDesc, iface, node)
      expect(iface['Dc/0/Voltage']).toBe(48)
      expect(iface['Motor/Temperature']).toBe(30)
      expect(iface['Controller/Temperature']).toBe(35)
      expect(iface['Coolant/Temperature']).toBe(40)
      expect(iface['Motor/RPM']).toBe(0)
      expect(iface['Motor/Direction']).toBe(0)
    })

    test.each([
      [{ include_motor_rpm: false, include_motor_direction: false }, 'Virtual E-drive'],
      [{ include_motor_rpm: true, include_motor_direction: false }, 'Virtual E-drive with RPM'],
      [{ include_motor_rpm: false, include_motor_direction: true }, 'Virtual E-drive with direction'],
      [{ include_motor_rpm: true, include_motor_direction: true }, 'Virtual E-drive with RPM and direction']
    ])('returns correct status text for rpm/direction config', (config, expected) => {
      const { ifaceDesc, iface, node } = makeFixtures()
      expect(motordrive.initialize(config, ifaceDesc, iface, node)).toBe(expected)
    })
  })

  describe('format', () => {
    const fmt = motordrive.properties['Motor/Direction'].format
    test.each([
      [0, 'Neutral'],
      [1, 'Reverse'],
      [2, 'Forward'],
      [99, 'unknown']
    ])('Motor/Direction %i → %s', (v, expected) => {
      expect(fmt(v)).toBe(expected)
    })
  })
})

// ---------------------------------------------------------------------------
// pvinverter
// ---------------------------------------------------------------------------

describe('pvinverter', () => {
  describe('initialize', () => {
    test('sets Position from config', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      pvinverter.initialize({ position: 2, pvinverter_nrofphases: 1 }, ifaceDesc, iface, node)
      expect(iface.Position).toBe(2)
    })

    test('defaults Position to 0 when not set', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      pvinverter.initialize({ pvinverter_nrofphases: 1 }, ifaceDesc, iface, node)
      expect(iface.Position).toBe(0)
    })

    test('1-phase adds L1 phase properties', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      pvinverter.initialize({ pvinverter_nrofphases: 1 }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L1/Current']).toBeDefined()
      expect(ifaceDesc.properties['Ac/L2/Current']).toBeUndefined()
    })

    test('3-phase adds L1-L3 phase properties', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      pvinverter.initialize({ pvinverter_nrofphases: 3 }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties['Ac/L3/Current']).toBeDefined()
    })

    test('sets default values when enabled', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      pvinverter.initialize({ pvinverter_nrofphases: 1, default_values: true }, ifaceDesc, iface, node)
      expect(iface['Ac/Power']).toBe(0)
      expect(iface['Ac/MaxPower']).toBe(1000)
      expect(iface.StatusCode).toBe(0)
    })

    test('returns phase count in status text', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = pvinverter.initialize({ pvinverter_nrofphases: 3 }, ifaceDesc, iface, node)
      expect(result).toBe('Virtual 3-phase pvinverter')
    })
  })

  describe('format', () => {
    test.each([
      [0, 'AC input 1'],
      [1, 'AC output'],
      [2, 'AC input 2'],
      [99, 'unknown']
    ])('Position %i → %s', (v, expected) => {
      expect(pvinverter.properties.Position.format(v)).toBe(expected)
    })

    test.each([
      [7, 'Running'],
      [8, 'Standby'],
      [10, 'Error'],
      [99, 'unknown']
    ])('StatusCode %i → %s', (v, expected) => {
      expect(pvinverter.properties.StatusCode.format(v)).toBe(expected)
    })
  })
})

// ---------------------------------------------------------------------------
// switch
// ---------------------------------------------------------------------------

describe('switch', () => {
  test('initialize runs without error', () => {
    const { ifaceDesc, iface, node } = makeFixtures()
    expect(() => switchMod.initialize({ switch_1_type: 1 }, ifaceDesc, iface, node)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// tank
// ---------------------------------------------------------------------------

describe('tank', () => {
  describe('initialize', () => {
    test('sets FluidType from config', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      tank.initialize({ fluid_type: 7 }, ifaceDesc, iface, node)
      expect(iface.FluidType).toBe(7)
    })

    test('includes BatteryVoltage with custom value when enabled', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties.BatteryVoltage = {}
      tank.initialize({ include_tank_battery: true, tank_battery_voltage: 3.7 }, ifaceDesc, iface, node)
      expect(iface.BatteryVoltage).toBe(3.7)
    })

    test('removes BatteryVoltage when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties.BatteryVoltage = {}
      iface.BatteryVoltage = 3.3
      tank.initialize({ include_tank_battery: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties.BatteryVoltage).toBeUndefined()
      expect(iface.BatteryVoltage).toBeUndefined()
    })

    test('removes Temperature when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties.Temperature = {}
      iface.Temperature = 20
      tank.initialize({ include_tank_temperature: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties.Temperature).toBeUndefined()
      expect(iface.Temperature).toBeUndefined()
    })

    test('keeps Temperature when included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties.Temperature = {}
      tank.initialize({ include_tank_temperature: true }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties.Temperature).toBeDefined()
    })

    test('calls node.error and returns undefined for invalid capacity', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = tank.initialize({ tank_capacity: 0 }, ifaceDesc, iface, node)
      expect(node.error).toHaveBeenCalledWith('Tank capacity must be greater than 0')
      expect(result).toBeUndefined()
    })

    test('sets Capacity for valid positive value', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      tank.initialize({ tank_capacity: 0.5 }, ifaceDesc, iface, node)
      expect(iface.Capacity).toBe(0.5)
    })

    test('sets Level=50 with default_values', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      tank.initialize({ default_values: true }, ifaceDesc, iface, node)
      expect(iface.Level).toBe(50)
    })

    test('returns fluid type in status text', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = tank.initialize({ fluid_type: 7 }, ifaceDesc, iface, node)
      expect(result).toBe('Virtual diesel tank sensor')
    })
  })

  describe('format', () => {
    const fmt = tank.properties.FluidType.format
    test.each([
      [0, 'Fuel'],
      [5, 'Black water (sewage)'],
      [11, 'Raw water'],
      [99, 'unknown']
    ])('FluidType %i → %s', (v, expected) => {
      expect(fmt(v)).toBe(expected)
    })
  })
})

// ---------------------------------------------------------------------------
// temperature
// ---------------------------------------------------------------------------

describe('temperature', () => {
  describe('initialize', () => {
    test('sets TemperatureType from config', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      temperature.initialize({ temperature_type: 3 }, ifaceDesc, iface, node)
      expect(iface.TemperatureType).toBe(3)
    })

    test('defaults TemperatureType to 2 when not set', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      temperature.initialize({}, ifaceDesc, iface, node)
      expect(iface.TemperatureType).toBe(2)
    })

    test('removes Humidity when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties.Humidity = {}
      iface.Humidity = null
      temperature.initialize({ include_humidity: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties.Humidity).toBeUndefined()
    })

    test('removes Pressure when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties.Pressure = {}
      temperature.initialize({ include_pressure: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties.Pressure).toBeUndefined()
    })

    test('removes BatteryVoltage when not included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      ifaceDesc.properties.BatteryVoltage = {}
      iface.BatteryVoltage = 3.3
      temperature.initialize({ include_temp_battery: false }, ifaceDesc, iface, node)
      expect(ifaceDesc.properties.BatteryVoltage).toBeUndefined()
    })

    test('sets BatteryVoltage to custom value when included', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      temperature.initialize({ include_temp_battery: true, temp_battery_voltage: 3.6 }, ifaceDesc, iface, node)
      expect(iface.BatteryVoltage).toBe(3.6)
    })

    test('sets Temperature=25 with default_values', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      temperature.initialize({ default_values: true }, ifaceDesc, iface, node)
      expect(iface.Temperature).toBe(25)
    })

    test('returns temperature type in status text', () => {
      const { ifaceDesc, iface, node } = makeFixtures()
      const result = temperature.initialize({ temperature_type: 1 }, ifaceDesc, iface, node)
      expect(result).toBe('Virtual fridge temperature sensor')
    })
  })

  describe('format', () => {
    const fmt = temperature.properties.TemperatureType.format
    test.each([
      [0, 'Battery'],
      [2, 'Generic'],
      [5, 'WaterHeater'],
      [6, 'Freezer'],
      [99, 'unknown']
    ])('TemperatureType %i → %s', (v, expected) => {
      expect(fmt(v)).toBe(expected)
    })
  })
})
