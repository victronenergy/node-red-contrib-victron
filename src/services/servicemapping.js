
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
        "name": "Voltage 1 (V)",
        "path": "/Dc/0/Voltage"
    },
    {
        "name": "Voltage 2 (V)",
        "path": "/Dc/1/Voltage"
    },
    {
        "name": "Current (A)",
        "path": "/Dc/0/Current"
    },
    {
        "name": "Temperature (°C)",
        "path": "/Dc/0/Temperature"
    },
    {
        "name": "Consumed Charge (Ah)",
        "path": "/ConsumedAmphours"
    },
    {
        "name": "State of Charge (%)",
        "path": "/Soc"
    },
    {
        "name": "Time to Go (s)",
        "path": "/TimeToGo"
    },
    {
        "name": "Relay State (on/off)",
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
                    "name": "State (on/off)",
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