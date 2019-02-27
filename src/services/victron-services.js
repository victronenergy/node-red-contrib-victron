/**
 * This file contains the node specific dbus service mappings
 * and related helper functions.
 */

const SERVICES = require("./services.json")

/**
 * Generates a unique hash from the given string.
 * This is used to identify services from each other.
 *
 * @param {string} str a string the hash is generated from
 */
function getHash(str){
    return str
        .split('')
        .reduce((a, b) => {
            a = (( a << 5 ) - a) + b.charCodeAt(0)
            return a & a
        }, 0)
}

/**
 * Constructs a node config object that is
 * used to render node-specific editable options in UI.
 */
const TEMPLATE = (service, name, paths) => {
    return {
        "service": `${service}`,
        "name": `${name}`,
        "id": getHash(service),
        "paths": paths
    }
}


const RELAY_FUNCTIONS = {
    0: 'alarm',
    1: 'generator',
    2: 'manual',
    3: 'tank pump'
}

const RELAY_MODE_WARNING = (func) =>
    `This relay is reserved for ${func} function. Please navigate to Settings > Relay and change it to manual.`

module.exports = {
    TEMPLATE,
    RELAY_FUNCTIONS,
    RELAY_MODE_WARNING,
    SERVICES
}