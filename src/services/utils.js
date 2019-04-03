/**
 * This file contains various utility functions
 * and enums.
 */

 /**
 * Calculates a 'semi-random' identifier which is used in e.g. tracking node connection statuses.
 */
function UUID() {
    return Math.floor((1 + Math.random()) * 0x10000000).toString(16)
}

const DEFAULT_SERVICE_NAMES = {
    "input-gps": {
        "gps": "GPS Device"
    },
    "input-ess": {
        "vebus": "ESS VE.Bus",
        "settings": "ESS System Settings"
    },
    "output-ess": {
        "vebus": "ESS VE.Bus",
        "settings": "ESS System Settings"
    }
}


const SERVICES = require("./services.json")

/**
 * Node status codes.
 */
const CONNECTED = { fill: "green", shape: "dot", text: "connected" }
const DISCONNECTED = { fill: "red", shape: "ring", text: "disconnected" }

/**
 * Constructs a node config object that is
 * used to render node-specific editable options in UI.
 */
const TEMPLATE = (service, name, paths) => {
    return {
        "service": `${service}`,
        "name": `${name}`,
        "paths": paths
    }
}

/**
 * Shown in the UI if the system relay mode is set to any other than 'manual'
 */
const RELAY_MODE_WARNING = (func) =>
    `This relay is reserved for ${func} function. Please navigate to Settings > Relay and change it to manual.`

/**
 * All possible system relay functions
 */
const RELAY_FUNCTIONS = {
    0: 'alarm',
    1: 'generator',
    2: 'manual',
    3: 'tank pump'
}

/**
 * Internal dbus-listener status codes
 */
const STATUS = {
    SERVICE_ADD: 1,
    SERVICE_REMOVE: 2,
    PATH_ADD: 3,
    PATH_REMOVE: 4,
    PROVIDER_STATUS: 5,
    PROVIDER_ERROR: 6,
    PLUGIN_ERROR: 7
}


module.exports = {
    CONNECTED,
    DISCONNECTED,
    RELAY_FUNCTIONS,
    RELAY_MODE_WARNING,
    SERVICES,
    STATUS,
    TEMPLATE,
    UUID,
    DEFAULT_SERVICE_NAMES
}
