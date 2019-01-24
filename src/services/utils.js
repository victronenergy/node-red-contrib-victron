/**
 * This file contains various utility functions
 * and enums.
 */

const CONNECTED = {fill: "green", shape: "dot", text: "connected"}
const DISCONNECTED = {fill: "red", shape: "ring", text: "disconnected"}

const STATUS = {
    SERVICE_ADD: 1,
    SERVICE_REMOVE: 2,
    PATH_ADD: 3,
    PATH_REMOVE: 4,
    PROVIDER_STATUS: 5,
    PROVIDER_ERROR: 6,
    PLUGIN_ERROR: 7
}

function UUID() {
    return Math.floor((1 + Math.random()) * 0x10000000).toString(16)
}

module.exports = {
    CONNECTED,
    DISCONNECTED,
    STATUS,
    UUID
}
