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
 * In case some of the whitelisted paths are missing from the CSVs,
 * the script generates a missingpaths.template.json template file that
 * can be used to manually populate with additional service and path
 * definitions.
 *
 * Usage:
 * // basic services.json generation
 * node parse-services.js
 *
 * // generate services.json and provide a filled template file
 * // of missing paths this file overrides the fields parsed from CSV:
 * env node parse-services.js ./additionalpaths.json
 */

const parse = require('csv-parse/lib/sync')
const fs = require('fs')
const _ = require('lodash')
const whitelist = require('./service-whitelist')

const OUTPUT_JSON = '../src/services/services.json'
const ENUM_CSV = './csv/dataAttributeEnums.csv'
const PATH_CSV = './csv/dataAttributes.csv'

// Debug
let missingPaths = {}

if (!(fs.existsSync(ENUM_CSV) && fs.existsSync(PATH_CSV))) {
    console.error(`Please make sure, that the files ${ENUM_CSV} and ${PATH_CSV} exist.`)
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
let dataAttributes = parse(readCsv(PATH_CSV), {
    columns: true
}).reduce((acc, item) => {
    acc[item.dbusServiceType] = acc[item.dbusServiceType] || {}

    // Add enums
    const attrEnums = dataAttributeEnums[item.idDataAttribute]
    if (attrEnums !== undefined) {
        item.enum = attrEnums.reduce((acc, e) => {
            acc[e.valueEnum] = e.nameEnum
            return acc
        }, {})
    }

    acc[item.dbusServiceType][item.dbusPath] = item
    return acc
}, {})

/**
 * Construct a services.json file based on service-whitelist.js file.
 */

if (process.argv[2]) {
    const _ = require('lodash')
    const additionalData = require(process.argv[2])
    dataAttributes = _.merge(dataAttributes, additionalData)
}


let data = Object.assign({}, whitelist) // clone whitelist

Object.entries(data).forEach(([nodeName, nodeServices]) => {
    Object.entries(nodeServices).forEach(([dbusService, servicePaths]) => {
        data[nodeName][dbusService] = servicePaths.map(dbusPath => {
            const attribute = _.get(dataAttributes, [dbusService, dbusPath])

            // skip undefined paths, print them if DEBUG env is enabled
            if (attribute === undefined) {
                if (missingPaths[dbusService] === undefined)
                    missingPaths[dbusService] = new Set([dbusPath])
                else
                    missingPaths[dbusService].add(dbusPath)
                return
            }

            const label = attribute.unit
                ? `${attribute.description} (${attribute.unit})`
                : `${attribute.description}`

            const pathObj = {
                path: dbusPath,
                type: attribute.dataType,
                //unit: attribute.unit,
                //name: attribute.description,
                name: label,
                enum: attribute.enum
            }

            // add "writable": true for whitelisted output nodes
            if (nodeName.startsWith('output')) pathObj.writable = true

            return pathObj
        })

    })

})

const jsonData = JSON.stringify(data, null, 4)

fs.writeFile(OUTPUT_JSON, jsonData, 'utf8', () => {
    console.log(`Parsing successful. Please see ${OUTPUT_JSON} for results.`)
});

// In case some paths are missing from the CSVs, generate a template file
// to manually fill in the missing paths
if (Object.keys(missingPaths).length) {

    const missingPathsTemplate = {}
    Object.keys(missingPaths).forEach(key => {
        let pathObjs = {}
        let missingPathsArray = [...missingPaths[key]]
        missingPathsArray.map(path => {
            pathObjs[path] = {
                description: `Name for ${path}`,
                dbusPath: path,
                dataType: 'float',
                unit: '',
                enum: {}
            }
        })
        missingPathsTemplate[key] = pathObjs
    })

    const missingPathsTemplateJSON = JSON.stringify(missingPathsTemplate, null, 4)
    fs.writeFile('./missingpaths.template.json', missingPathsTemplateJSON, 'utf8', () => { });

    console.log('The following paths are missing from the CSV:')
    console.log(missingPaths)
}
