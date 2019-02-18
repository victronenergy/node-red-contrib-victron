#!/usr/bin/env node

/**
 * This script is used to parse the available dbus paths for nodes from
 * VRM CSV's. Three CSV files are required in ./csv directory:
 *
 * 1.) dataAttributeEnums.csv for CSV descriptions
 * 2.) dataAttributes.csv for dbus paths
 * 3.) deviceTypes.csv for available devices
 *
 * The script parses the CSV files and generates a service.json
 * file which is used to generate the services for the
 * /victron/services REST API.
 */

const parse = require('csv-parse/lib/sync')
const fs = require('fs')
const serviceWhitelist = require('./service-whitelist')


const OUTPUT_JSON = '../src/services/services.json'
const ENUM_CSV = 'csv/dataAttributeEnums.csv'
const PATH_CSV = 'csv/dataAttributes.csv'
const DEVICE_CSV = 'csv/deviceTypes.csv'

// Debug
let devicePaths = {}
let missingPaths = {}

const readCsv = filename => fs.readFileSync(`${filename}`, 'UTF-8')

/**
 * Parse all enums and group them by key idDataAttribute.
 */
const dataAttributeEnums = parse(readCsv(ENUM_CSV), {
    columns: true
    }).reduce((acc, item) => {
        !(item.idDataAttribute in acc)
            ? acc[item.idDataAttribute] = [item]
            : acc[item.idDataAttribute].push(item)
        return acc
    }, {})

/**
 * Parse all dbus paths.
 */
const dataAttributes = parse(readCsv(PATH_CSV), {
    columns: true
    }).reduce((acc, item) => {
        acc[item.idDeviceType] = acc[item.idDeviceType] || {}

        // Add enums
        const attrEnums = dataAttributeEnums[item.idDataAttribute]
        if (attrEnums !== undefined) {
            item.enum = attrEnums.reduce((acc, e) => {
                acc[e.valueEnum] = e.nameEnum
                return acc
            }, {})
        }

        acc[item.idDeviceType][item.dbusPath] = item
        return acc
    }, {})

/**
 * Parse all available devices and assign previously parsed
 * dbus paths for each device.
 */
const deviceTypes = parse(readCsv(DEVICE_CSV), {
    columns: true
    }).reduce((acc, item) => {
        acc[item.Device] = item
        item.dataAttributes = dataAttributes[item.idDeviceType]
        devicePaths[item.Device] = Object.keys(item.dataAttributes).map(path => path) // debug
        return acc
    }, {})

// For relay nodes, we have custom logic in the frontend
// TODO: also add dbus paths in this stage (?)

/**
 * Construct a services.json file based on service-whitelist.js file.
 */
const data = {}
Object.keys(serviceWhitelist).forEach(deviceType => {
    const deviceData = deviceTypes[deviceType] || {dataAttributes: {}}

    data[deviceType] = {
        'device': deviceType,
        paths: serviceWhitelist[deviceType].map(dbusPath => {
            const attribute = deviceData.dataAttributes[dbusPath]

            if (attribute === undefined) { // skip undefined paths, print them if DEBUG env is enabled
                if (missingPaths[deviceType] === undefined)
                    missingPaths[deviceType] = [dbusPath]
                else
                    missingPaths[deviceType].push(dbusPath)
                return
            }

            const label = attribute.unit
                ? `${attribute.description} (${attribute.unit})`
                : `${attribute.description}`

            const pathObj = {
                path: dbusPath,
                //service: attribute.dbusServiceType,
                type: attribute.dataType,
                //unit: attribute.unit,
                //name: attribute.description,
                name: label,
                enum: attribute.enum
            }

            return pathObj
        })
    }
})

const jsonData = JSON.stringify(data, null, 4)

fs.writeFile(OUTPUT_JSON, jsonData, 'utf8', () => {
    console.log(`Parsing successful. Please see ${OUTPUT_JSON} for results.`)
});

if (process.env.DEBUG) {
    const devicePathsJSON = JSON.stringify(devicePaths, null, 4)
    const missingPathsJSON = JSON.stringify(missingPaths, null, 4)

    fs.writeFile('./allpaths.json', devicePathsJSON, 'utf8', () => {
        console.log('All parsed paths are saved to ./allpaths.json.')
    });

    fs.writeFile('./missingpaths.json', missingPathsJSON, 'utf8', () => {
        console.log('All missing paths are saved to ./missingpaths.json.')
    });

    console.log('The following paths are missing from the CSV:')
    console.log(missingPaths)
}