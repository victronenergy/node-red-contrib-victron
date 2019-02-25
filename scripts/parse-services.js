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
 *
 * If the DEBUG environment variable is set,
 * the script generates the following debug files:
 *  - missingpaths.json - a json file showing the paths that can
 *    be found on the service-whitelist.js, but not on parsed CSVs.
 *  - missingpaths.template.json - a json file template, that can be
 *    filled in order to provide additional service + path definitions
 *    to the parser
 *  - allpaths.json - all parsed CSV data is saved in allpaths.json
 *
 * Usage:
 * // basic services.json generation
 * node parse-services.js
 *
 * // generate services.json and debug files
 * env DEBUG=True node parse-services.js
 *
 * // generate services.json and debug files,
 * // additionally, provide a filled template file of missing paths
 * // this file overrides the fields parsed from CSV
 * env DEBUG=True node parse-services.js ./additionalpaths.json
 */

const parse = require('csv-parse/lib/sync')
const fs = require('fs')
const _ = require('lodash')
const whitelist = require('./service-whitelist')


const OUTPUT_JSON = '../src/services/services.json'
const ENUM_CSV = './csv/dataAttributeEnums.csv'
const PATH_CSV = './csv/dataAttributes.csv'
const DEVICE_CSV = './csv/deviceTypes.csv'

// Debug
let devicePaths = {}
let missingPaths = {}

if (!(fs.existsSync(ENUM_CSV) && fs.existsSync(PATH_CSV) && fs.existsSync(DEVICE_CSV))) {
    console.error(`Please make sure, that the files ${ENUM_CSV}, ${PATH_CSV} and ${DEVICE_CSV} exist.`)
    process.exit()
}

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
let deviceTypes = parse(readCsv(DEVICE_CSV), {
    columns: true
    }).reduce((acc, item) => {
        acc[item.Device] = item
        item.dataAttributes = dataAttributes[item.idDeviceType]
        devicePaths[item.Device] = Object.keys(item.dataAttributes).map(path => path) // debug
        return acc
    }, {})

/**
 * Construct a services.json file based on service-whitelist.js file.
 */
const data = {}
if (process.argv[2]) {
    const _ = require('lodash')
    const additionalData = require(process.argv[2])
    deviceTypes = _.merge(deviceTypes, additionalData)
}

Object.keys(whitelist.INPUT_PATHS).forEach(deviceType => {
    const deviceData = deviceTypes[deviceType] || {dataAttributes: {}}

    data[deviceType] = {
        'device': deviceType,
        paths: whitelist.INPUT_PATHS[deviceType].map(dbusPath => {
            const attribute = deviceData.dataAttributes[dbusPath]

            // skip undefined paths, print them if DEBUG env is enabled
            if (attribute === undefined) {
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
                //service: attribute.dbusServiceType, // TODO: -> maybe construct services.json based on dbus service, not device
                type: attribute.dataType,
                //unit: attribute.unit,
                //name: attribute.description,
                name: label,
                enum: attribute.enum
            }

            // add "writable": true for whitelisted output nodes
            let isOutputPath = _.get(whitelist.OUTPUT_PATHS, deviceType, []).includes(dbusPath)
            if (isOutputPath) pathObj.writable = true

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

    // create a missingPaths template
    // to easily fill in missing data
    const missingPathsTemplate = {}
    Object.keys(missingPaths).forEach(key => {
        let pathObjs = {}
        missingPaths[key].map(path => {
            pathObjs[path] = {
                description: `Name for ${path}`,
                dbusPath: path,
                dataType: 'float',
                unit: '',
                enum: {}
            }
        })
        missingPathsTemplate[key] = {
            dataAttributes: pathObjs
        }
    })

    const missingPathsTemplateJSON = JSON.stringify(missingPathsTemplate, null, 4)
    fs.writeFile('./missingpaths.template.json', missingPathsTemplateJSON, 'utf8', () => {
        console.log('All missing paths are saved to ./missingpaths.json.')
    });

    console.log('The following paths are missing from the CSV:')
    console.log(missingPaths)
}
