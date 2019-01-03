
const BATTERY =  {
    "service": "com.victronenergy.battery",
    "paths": [
        {
            "label": "Voltage 1 (V)",
            "path": "/Dc/0/Voltage"
        },
        {
            "label": "Voltage 2 (V)",
            "path": "/Dc/1/Voltage"
        },
        {
            "label": "Current (A)",
            "path": "/Dc/0/Current"
        },
        {
            "label": "Temperature (°C)",
            "path": "/Dc/0/Temperature"
        },
        {
            "label": "Consumed Charge (Ah)",
            "path": "/ConsumedAmphours"
        },
        {
            "label": "State of Charge (%)",
            "path": "/Soc"
        },
        {
            "label": "Time to Go (s)",
            "path": "/TimeToGo"
        },
        {
            "label": "Battery Low Threshold (V)",
            "path": "/Info/BatteryLowVoltage"
        },
        {
            "label": "Relay State (on/off)",
            "path": "/Relay/0/State"
        },
        ,
        {
            "label": "Ext. Relay State - Lynx (on/off)",
            "path": "/Io/ExternalRelay"
        }
    ]
}

const RELAY = {
    "service": "com.victronenergy.system",
    "paths": [ 
        {
            "label": "State (on/off)",
            "path": "/Relay/0/State"
        }
    ]
}

module.exports = {
    BATTERY,
    RELAY
}