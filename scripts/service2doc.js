const fs = require('fs')
fs.readFile('../src/services/services.json', 'utf8', (err, jsonString) => {
    if (err) {
        console.log("Error reading file from disk:", err)
        return
    }
    try {
        const services = JSON.parse(jsonString)
        Object.keys(services).forEach(function(k) {
          console.log('<script type="text/x-red" data-help-name="victron-'+k+'">')
          Object.keys(services[k]).forEach(function(v) {
            if ( v === 'help' ) { 
              console.log(services[k].help);
              return;
            }
            console.log('<h3>'+v+'</h3>');
            console.log('<dl class="message-properties">');
            Object.keys(services[k][v]).forEach(function(p) {
              console.log('  <dt class="optional">'+services[k][v][p].name+'<span class="property-type">'+services[k][v][p].type+'</dt>');
              console.log('  <dd>Dbus path: <b>'+services[k][v][p].path+'</b>');
              if ( services[k][v][p].type === 'enum' ) {
                console.log("<ul>");
                Object.keys(services[k][v][p].enum).forEach(function(e) {
                   if ( services[k][v][p].enum[e]) {
                     console.log('  <li>'+e+' - '+services[k][v][p].enum[e]+'</li>');
                   }
                });
                console.log("</ul>");
              }
              if (services[k][v][p].remarks) {
                console.log(services[k][v][p].remarks)
              }
              console.log("</dd>");
            });
            console.log('</dl>');
          });
          console.log('</script>');
          console.log('');
        })
} catch(err) {
        console.log('Error parsing JSON string:', err)
    }
})
