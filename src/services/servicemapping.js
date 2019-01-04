
const BATTERY =  (service, name) => {
    return {
        "service": `${service}`,
        "name": `${name}`,
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
                "label": "Relay State (on/off)",
                "path": "/Relay/0/State"
            }
        ]
    }
}

const RELAY = (service, path, name) => {
        return {
            "service": `${service}`,
            "name": `${name}`,
            "paths": [ 
                {
                    "label": "State (on/off)",
                    "path": `${path}`
                }
            ]
        }
}

module.exports = {
    BATTERY,
    RELAY
}