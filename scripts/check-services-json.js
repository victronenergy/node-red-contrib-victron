// Also see https://github.com/victronenergy/node-red-contrib-victron/issues/115

const fs = require('fs');
const Excel = require('exceljs');
const yargs = require('yargs');

var argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -s services.json -x modbus_tcp.xlsx')
    .option('services', {
      alias: 's',
      describe: 'Services file'
    })
    .option('excel', {
      alias: 'x',
      describe: 'Excel file, containing the modbus_tcp information'
    })
    .demandOption(['s','x'])
    .help('h')
    .version(false)
    .argv;

services_json = argv.services;
xls_file = argv.excel;

// Read the services.json file
let services = JSON.parse(fs.readFileSync( services_json ));

var workbook = new Excel.Workbook(); 
workbook.xlsx.readFile(xls_file)
  .then(function() {
    var worksheet = workbook.getWorksheet("Field list");
    worksheet.eachRow({ includeEmpty: true }, function(row, rowNumber) {
      // We can ignore the first two rows
      if ( rowNumber <= 2 ) { return; }
      // Determine the node name. If it is writeable: output else input
      if ( row.values[8] && row.values[8] === "yes" ) { node = "output-"; } else { node = "input-"; };
      node = node + row.values[1].split('.')[2];
      path = row.values[7];
      // console.log("Check for node " + node + ", path: " + path);

      if ( ! services[node] ) {
        console.log("// Missing node in services.json: " + node);
        //process.exit(1);
      } else {
        // The node exists, check for the path within the node
        // We make an array of all of the paths for this node
        paths = [];
        for ( const [key, value] of Object.entries(services[node])) {
          if ( Object.prototype.toString.call(value) === '[object Array]' ) {
            value.forEach(item => {
              paths.push(item.path);
            })
          }
        }

        // And check if the path we expect is included in the array of paths
        if (!paths.includes(path)) {
          // Print some info on the missing entry
          name = row.values[2];
          if ( row.values[9] && ! row.values[9].match(/;/) ) {
            name = name + ' (' + row.values[9] + ')';
          }
          // check the type; if row 9 contains a semicolon, it is enum. Else it is a bit of
          // a guess, but we default it to float if we are not sure
          if ( row.values[9] && row.values[9].match(/;/) ) {
            type = "enum";
          } else {
            if ( row.values[4].match(/string/) ) {
              type = "string";
            } else {
              type = "float";
            }
          }
          console.log("// Missing path in services.json node: " + node + ", path: " + path );
          missing = {
            'path': path,
            'type': type,
            'name': name,
          };

          if ( type === "enum" ) {
            missing['enum'] = {};
            row.values[9].split(';').forEach( en => {
              x = en.split('=');
              missing['enum'][x[0]] = x[1];
            })
          }

          if ( row.values[8] && row.values[8] === "yes" ) { missing['writable'] = true; } 

          console.log(JSON.stringify(missing, null, 4));
        }
      }
    });
  });
