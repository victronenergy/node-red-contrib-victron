
const BATTERY =  {
    "service": "com.victronenergy.battery",
    "paths": [
        {
            "label": "Voltage (V)",
            "path": "/Dc/0/Voltage"
        },
        {
            "label": "Current (A)",
            "path": "/Dc/0/Current"
        },
        {
            "label": "Power (W)",
            "path": "/Dc/0/Power"
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