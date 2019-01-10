
/**
 * Constructs a battery object that is returned by
 * configuration node's /victron/services REST endpoint.
 * This is used to build battery node's edit options.
 */
const BATTERY = (service, name, paths) => {
    return {
        "service": `${service}`,
        "name": `${name}`,
        "paths": paths
    }
}

/**
 * All available battery node measurements.
 * This array is filtered against the systemconfiguration cache.
 */
const BATTERY_PATHS = [
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

/**
 * Constructs a relay object, that is
 * used to build the relay node's edit options.
 */
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
    BATTERY_PATHS,
    RELAY
}