const yargs = require('yargs');
const fs = require('fs')

var argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -s services.json -t [md|nodered]')
    .option('services', {
      alias: 's',
      describe: 'Services file'
    })
    .option('register', {
      alias: 'r',
      describe: 'Register file'
    })
    .option('type', {
      alias: 't',
      describe: 'choose the output type',
      choices: ['nodered', 'md']
    })
    .demandOption(['s', 't'])
    .help('h')
    .version(false)
    .argv;

services_json = argv.services;
register_html = argv.register;

// ## Get the label info from ../nodes/victron-nodes.html as well
const searchLabelInfo = (filename) => {
    return new Promise((resolve) => {
        
        const regEx = new RegExp(/^ *register(In|Out)putNode\('[^,]*', '([^']*)', '([^']*)'\);/, "")
        var result = new Object();

        fs.readFile(filename, 'utf8', function (err, contents) {
            let lines = contents.toString().split("\n");
            lines.forEach(line => {
                if (line && line.search(regEx) >= 0) {
                    var label = line.replace(regEx, '$2');
                    var node = line.replace(regEx, '$3');
                    result[node] = label
                }
            })
            resolve(result);
        })
    });
}

function show(a, text) {
  if ( a === argv.type ) {
    console.log(text)
  }
}

searchLabelInfo(register_html).then(function(labelinfo){
  fs.readFile(services_json, 'utf8', (err, jsonString) => {
    if (err) {
        console.log("Error reading file from disk:", err)
        return
    }
    try {
        const services = JSON.parse(jsonString)
        var oc = false;
        show('md', '# Input nodes\n')
        Object.keys(services).forEach(function(k) {
          show('nodered', '<script type="text/x-red" data-help-name="victron-'+k+'">')
          if (/output-/.test(k)) {
            labelinfo[k] += ' Control';
            if ( oc === false) {show('md', '# Output nodes\n') };
            oc = true;
          }
          show('md', '## '+labelinfo[k])
          Object.keys(services[k]).forEach(function(v) {
            if ( v === 'help' ) { 
              show('nodered', services[k].help);
              var mdtext = services[k].help
                             .replace(/<[^b]*b>/g, '**')
                             .replace(/<[^i]*i>/g, '_')
                             .replace(/<[^>]*>/ig, '');
              show('md', '\n'+mdtext+'\n')
              return;
            }
            show('nodered', '<h3>'+v+'</h3>');
            show('nodered', '<dl class="message-properties">');
            Object.keys(services[k][v]).forEach(function(p) {
              show('nodered', '  <dt class="optional">'+services[k][v][p].name+'<span class="property-type">'+services[k][v][p].type+'</dt>');
              show('nodered', '  <dd>Dbus path: <b>'+services[k][v][p].path+'</b>');
              show('md', '**'+services[k][v][p].name + '**, '+'dbus path: `'+services[k][v][p].path+'`, type _'+services[k][v][p].type+'_  ')
              if ( services[k][v][p].type === 'enum' ) {
                show('nodered', "<ul>");
                Object.keys(services[k][v][p].enum).forEach(function(e) {
                   if ( services[k][v][p].enum[e]) {
                     show('nodered', '  <li>'+e+' - '+services[k][v][p].enum[e]+'</li>');
                     show('md', '  - '+e+' - '+services[k][v][p].enum[e]);
                   }
                });
                show('nodered', "</ul>");
                show('md', '\n')
              }
              if (services[k][v][p].remarks) {
                show('nodered', services[k][v][p].remarks)
              }
              show('nodered', "</dd>");
            });
            show('nodered', '</dl>');
          });
          show('nodered', '</script>\n');
          show('md', '\n');
        })
    } catch(err) {
        console.log('Error parsing JSON string:', err)
    }
  })
})

