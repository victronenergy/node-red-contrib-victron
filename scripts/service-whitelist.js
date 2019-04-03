module.exports = {
    "input-digitalinput": {
        "pulsemeter": [
            // "/ProductId",
            "/Aggregate",
            "/Count"
            // "/Connected"
        ],
        "digitalinput": [
            "/ProductId",
            "/Alarm",
            "/State",
            "/Count",
            "/Type"
            // "/Connected"
        ]
    },
    "input-tank": {
        "tank": [
            "/Capacity",
            "/Remaining",
            "/Level",
            "/Status",
            "/FluidType",
            "/Standard"
        ]
    },
    "input-temperature": {
        "temperature": [
            "/Temperature",
            "/Status",
            "/TemperatureType"
        ]
    },
    "input-inverter": {
        "inverter": [
            // "/ProductId",
            // "/Serial",
            "/Dc/0/Voltage",
            "/Ac/Out/L1/V",
            "/Ac/Out/L1/I",
            "/Mode",
            "/Relay/0/State",
            "/State"
        ]
    },
    "input-pvinverter": {
        "pvinverter": [
            // "/ProductId",
            // "/FirmwareVersion",
            // "/Position",
            "/Ac/L1/Voltage",
            "/Ac/L1/Current",
            "/Ac/L1/Power",
            "/Ac/L1/Energy/Forward",
            "/Ac/L2/Voltage",
            "/Ac/L2/Current",
            "/Ac/L2/Power",
            "/Ac/L2/Energy/Forward",
            "/Ac/L3/Voltage",
            "/Ac/L3/Current",
            "/Ac/L3/Power",
            "/Ac/L3/Energy/Forward",
            "/StatusCode",
            "/ErrorCode",
            // "/Serial",
            // "/FroniusDeviceType",
            "/Ac/Energy/Forward",
            "/Ac/Power"
        ]
    },
    "input-accharger": {
        "charger": [
            // "/ProductId",
            // "/FirmwareVersion",
            // "/Serial",
            "/Dc/0/Voltage",
            "/Dc/0/Current",
            "/Dc/0/Temperature",
            "/Dc/1/Voltage",
            "/Dc/1/Current",
            "/Dc/1/Temperature",
            "/Dc/2/Voltage",
            "/Dc/2/Current",
            "/Dc/2/Temperature",
            "/Ac/In/L1/I",
            "/Ac/In/L1/P",
            "/Ac/In/CurrentLimit",
            "/Mode",
            "/State",
            "/ErrorCode",
            "/Relay/0/State",
            "/Alarms/LowVoltage",
            "/Alarms/HighVoltage",
            "/NrOfOutputs"
        ]
    },
    "input-solarcharger": {
        "solarcharger": [
            // "/FirmwareVersion",
            "/Dc/0/Voltage",
            "/Dc/0/Current",
            "/Dc/0/Temperature",
            "/Mode",
            "/State",
            "/Pv/V",
            "/Pv/I",
            // "/Equalization/Pending",
            // "/Equalization/TimeRemaining",
            "/Relay/0/State",
            "/Alarms/LowVoltage",
            "/Alarms/HighVoltage",
            // "/History/Daily/0/Yield",
            // "/History/Daily/0/MaxPower",
            // "/History/Daily/1/Yield",
            // "/History/Daily/1/MaxPower",
            "/ErrorCode",
            // "/ProductId",
            // "/Serial",
            "/Load/State",
            "/Load/I",
            "/Yield/User",
            "/Yield/Power",
            "/Yield/System",
            "/MPPOperationMode"
        ]
    },
    "input-battery": {
        "battery": [
            // "/ProductId",
            // "/FirmwareVersion",
            "/Dc/0/Voltage",
            "/Dc/1/Voltage",
            "/Dc/0/Current",
            "/ConsumedAmphours",
            "/Soc",
            "/TimeToGo",
            "/Relay/0/State",
            // "/History/DeepestDischarge",
            // "/History/LastDischarge",
            // "/History/AverageDischarge",
            // "/History/ChargeCycles",
            // "/History/FullDischarges",
            // "/History/TotalAhDrawn",
            // "/History/MinimumVoltage",
            // "/History/MaximumVoltage",
            // "/History/TimeSinceLastFullCharge",
            // "/History/AutomaticSyncs",
            // "/History/LowVoltageAlarms",
            // "/History/HighVoltageAlarms",
            // "/History/LowStarterVoltageAlarms",
            // "/History/HighStarterVoltageAlarms",
            // "/History/MinimumStarterVoltage",
            // "/History/MaximumStarterVoltage",
            // "/Serial",
            "/Dc/0/Temperature",
            "/Dc/0/MidVoltage",
            "/Dc/0/MidVoltageDeviation",
            "/Alarms/LowVoltage",
            "/Alarms/HighVoltage",
            "/Alarms/LowStarterVoltage",
            "/Alarms/HighStarterVoltage",
            "/Alarms/LowSoc",
            "/Alarms/LowTemperature",
            "/Alarms/HighTemperature",
            "/Alarms/MidVoltage",
            "/Alarms/FuseBlown",
            "/Alarms/HighInternalTemperature",
            // "/State", // Lynx BMS
            // "/ErrorCode", // Lynx BMS
            // "/SystemSwitch",
            // "/Balancing",
            // "/System/NrOfBatteries",
            // "/System/BatteriesParallel",
            // "/System/BatteriesSeries",
            // "/System/NrOfCellsPerBattery",
            // "/System/MinCellVoltage",
            // "/System/MaxCellVoltage",
            // "/Diagnostics/ShutDownsDueError",
            // "/Diagnostics/LastErrors/1/Error",
            // "/Diagnostics/LastErrors/2/Error",
            // "/Diagnostics/LastErrors/3/Error",
            // "/Diagnostics/LastErrors/4/Error",
            // "/Io/AllowToCharge",
            // "/Io/AllowToDischarge",
            // "/Io/ExternalRelay",
            // "/History/MinimumCellVoltage",
            // "/History/MaximumCellVoltage",
            // "/History/DischargedEnergy",
            // "/History/ChargedEnergy",
            "/Soh",
            "/Info/MaxChargeVoltage",
            "/Info/MaxDischargeVoltage",
            "/Info/MaxChargeCurrent",
            "/Info/MaxDischargeCurrent",
            "/Alarms/CellImbalance",
            "/Alarms/HighChargeCurrent",
            "/Alarms/HighDischargeCurrent",
            "/Alarms/InternalFailure",
            "/Alarms/HighChargeTemperature",
            "/Alarms/LowChargeTemperature",
            "/Dc/0/Power" // Missing
        ]
    },
    "input-gridmeter": {
        "grid": [
            // "/ProductId",
            "/Ac/Energy/Forward",
            "/Ac/Energy/Reverse",
            "/Ac/Power",
            "/Ac/Current",
            "/Ac/Voltage",
            "/Ac/L1/Current",
            "/Ac/L1/Energy/Forward",
            "/Ac/L1/Energy/Reverse",
            "/Ac/L1/Power",
            "/Ac/L1/Voltage",
            "/Ac/L2/Current",
            "/Ac/L2/Energy/Forward",
            "/Ac/L2/Energy/Reverse",
            "/Ac/L2/Power",
            "/Ac/L2/Voltage",
            "/Ac/L3/Current",
            "/Ac/L3/Energy/Forward",
            "/Ac/L3/Energy/Reverse",
            "/Ac/L3/Power",
            "/Ac/L3/Voltage",
            "/DeviceType",
            "/ErrorCode"
        ]
    },
    "input-vebus": {
        "vebus": [
            "/Ac/ActiveIn/L1/V",
            "/Ac/ActiveIn/L2/V",
            "/Ac/ActiveIn/L3/V",
            "/Ac/ActiveIn/L1/I",
            "/Ac/ActiveIn/L2/I",
            "/Ac/ActiveIn/L3/I",
            "/Ac/ActiveIn/L1/F",
            "/Ac/ActiveIn/L2/F",
            "/Ac/ActiveIn/L3/F",
            "/Ac/ActiveIn/L1/P",
            "/Ac/ActiveIn/L2/P",
            "/Ac/ActiveIn/L3/P",
            "/Ac/In/1/CurrentLimit",
            "/Ac/In/1/CurrentLimitIsAdjustable",
            "/Ac/In/2/CurrentLimit",
            "/Ac/In/2/CurrentLimitIsAdjustable",
            "/Ac/Out/L1/V",
            "/Ac/Out/L2/V",
            "/Ac/Out/L3/V",
            "/Ac/Out/L1/I",
            "/Ac/Out/L2/I",
            "/Ac/Out/L3/I",
            "/Ac/Out/L1/F",
            // "/Ac/ActiveIn/CurrentLimit",
            "/Ac/Out/L1/P",
            "/Ac/Out/L2/P",
            "/Ac/Out/L3/P",
            "/Dc/0/Voltage",
            "/Dc/0/Current",
            "/Ac/NumberOfPhases",
            "/Ac/ActiveIn/ActiveInput",
            "/Soc",
            "/State",
            "/VebusError",
            "/Alarms/HighTemperature",
            "/Alarms/LowBattery",
            "/Alarms/Overload",
            "/Mode",
            "/ModeIsAdjustable",
            // "/FirmwareVersion",
            // "/ProductId",
            // "/ShortIds",
            // "/Hub4/L1/AcPowerSetpoint",
            // "/Hub4/L2/AcPowerSetpoint",
            // "/Hub4/L3/AcPowerSetpoint",
            // "/Hub4/LowSoc",
            // "/Hub4/Sustain",
            // "/Mgmt/Connection",
            "/Energy/AcIn1ToInverter",
            "/Energy/AcIn2ToInverter",
            "/Energy/AcIn1ToAcOut",
            "/Energy/AcIn2ToAcOut",
            "/Energy/InverterToAcIn1",
            "/Energy/InverterToAcIn2",
            "/Energy/AcOutToAcIn1",
            "/Energy/AcOutToAcIn2",
            "/Energy/InverterToAcOut",
            "/Energy/OutToInverter"
        ]
    },
    "input-gps": {
        "gps": [
            "/Altitude",
            // "/Connected",
            "/Course",
            "/Fix",
            // "/MagneticVariation",
            "/NrOfSatellites",
            "/Position/Latitude",
            "/Position/Longitude",
            "/Speed",
            "/UtcTimestamp"
        ]
    },
    "input-ess": {
        "vebus": [
            "/Hub4/DisableFeedIn",
            "/Hub4/DisableCharge",
            "/Hub4/L1/AcPowerSetpoint",
            "/Hub4/L2/AcPowerSetpoint",
            "/Hub4/L3/AcPowerSetpoint"
        ],
        "settings": [
            "/Settings/CGwacs/Hub4Mode", // Read only for now
            "/Settings/CGwacs/AcPowerSetPoint",
            "/Settings/CGwacs/BatteryLife/MinimumSocLimit",
            "/Settings/CGwacs/BatteryLife/State",
            "/Settings/CGwacs/Hub4Mode",
            "/Settings/CGwacs/MaxDischargePower",
            "/Settings/CGwacs/OvervoltageFeedIn",
            "/Settings/CGwacs/PreventFeedback",
            "/Settings/SystemSetup/MaxChargeCurrent"
        ]
    },
    "output-relay": {
        "system": [
            "/Relay/0/State",
            "/Relay/1/State"
        ],
        "battery": [
            "/Relay/0/State"
        ],
        "charger": [
            "/Relay/0/State"
        ],
        "solarcharger": [
            "/Relay/0/State"
        ],
        "inverter": [
            "/Relay/0/State"
        ]
    },
    "output-vebus": {
        "vebus": [
            "/Mode",
            "/Ac/In/1/CurrentLimit",
            "/Ac/In/2/CurrentLimit",
        ]
    },
    "output-inverter": {
        "inverter": [
            "/Mode"
        ]
    },
    "output-accharger": {
        "charger": [
            "/Ac/In/CurrentLimit",
            "/Mode",
            "/Relay/0/State"
        ]
    },
    "output-solarcharger": {
        "solarcharger": [
            "/Mode",
            "/MPPOperationMode"
        ]
    },
    "output-ess": {
        "vebus": [
            "/Hub4/DisableFeedIn",
            "/Hub4/DisableCharge",
            "/Hub4/L1/AcPowerSetpoint",
            "/Hub4/L2/AcPowerSetpoint",
            "/Hub4/L3/AcPowerSetpoint"
        ],
        "settings": [
            "/Settings/CGwacs/AcPowerSetPoint",
            "/Settings/CGwacs/BatteryLife/MinimumSocLimit",
            "/Settings/CGwacs/BatteryLife/State",
            "/Settings/CGwacs/Hub4Mode",
            "/Settings/CGwacs/MaxDischargePower",
            "/Settings/CGwacs/OvervoltageFeedIn",
            "/Settings/CGwacs/PreventFeedback",
            "/Settings/SystemSetup/MaxChargeCurrent"
        ]
    }
}