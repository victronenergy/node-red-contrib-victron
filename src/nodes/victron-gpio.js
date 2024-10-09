module.exports = function(RED) {
    function DigitalOutputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        // Check if NODE_RED_DBUS_ADDRESS is set
        if (process.env.NODE_RED_DBUS_ADDRESS) {
            const errorMsg = `NODE_RED_DBUS_ADDRESS is set to "${process.env.NODE_RED_DBUS_ADDRESS}". This node will not function.`;
            node.status({fill:"red", shape:"ring", text:"DBUS Address set"});
            node.error(errorMsg);
            return; // Exit the function early
        }
        
        // Initialize node properties
        node.gpioPath = '/run/io-ext/gpiochip388';
        node.availableOutputs = [];
        
        // Function to check available GPIO outputs
        function checkAvailableOutputs() {
            const fs = require('fs');
            const path = require('path');
            
            node.availableOutputs = [];
            
            for (let i = 1; i <= 9; i++) {
                const filePath = path.join(node.gpioPath, `output_${i}`, 'value');
                if (fs.existsSync(filePath)) {
                    node.availableOutputs.push(i);
                }
            }
            
            // Update the dropdown options in the Node-RED editor
            node.context().set('availableOutputs', node.availableOutputs);
            RED.comms.publish('gpio-outputs', { id: node.id, outputs: node.availableOutputs, dbusAddress: process.env.NODE_RED_DBUS_ADDRESS });
        }
        
        // Check available outputs on node initialization
        checkAvailableOutputs();
        
        // Handle incoming messages
        node.on('input', function(msg) {
            const fs = require('fs');
            const path = require('path');
            
            const outputNumber = parseInt(config.output);
            const value = (msg.payload === true || msg.payload === 1 || msg.payload === '1') ? '1' : '0';
            
            if (node.availableOutputs.includes(outputNumber)) {
                const filePath = path.join(node.gpioPath, `output_${outputNumber}`, 'value');
                
                fs.writeFile(filePath, value, (err) => {
                    if (err) {
                        node.error(`Error writing to GPIO ${outputNumber}: ${err}`);
                    } else {
                        node.status({fill:"green", shape:"dot", text:`Output ${outputNumber}: ${value}`});
                    }
                });
            } else {
                node.error(`Invalid output number: ${outputNumber}`);
            }
        });
        
        // Clean up on close
        node.on('close', function() {
            // Add any cleanup code here if needed
        });
    }
    
    RED.nodes.registerType("digital-output", DigitalOutputNode);
    
    // Serve the custom node configuration UI
    RED.httpAdmin.get("/gpio-outputs/:id", RED.auth.needsPermission("digital-output.read"), function(req, res) {
        var node = RED.nodes.getNode(req.params.id);
        if (node && node.availableOutputs) {
            res.json({outputs: node.availableOutputs, dbusAddress: process.env.NODE_RED_DBUS_ADDRESS});
        } else {
            res.status(404).end();
        }
    });
}