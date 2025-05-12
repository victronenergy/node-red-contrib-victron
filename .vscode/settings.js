module.exports = {
    uiPort: 1880,
    flowFile: 'flows.json',
    userDir: process.env.HOME + '/.node-red',
    functionGlobalContext: {},
    debugMaxLength: 1000,
    nodesDir: [process.env.HOME + '/git/node-red-contrib-victron/src/nodes'],
    verbose: true,
    logging: {
        console: {
            level: "debug",
            metrics: false,
            audit: false
        }
    },
contextStorage: {
    default: "memory",
    memory: { module: "memory" },
    persistent: {
        module: "localfilesystem",
        config: {
            dir: process.env.HOME + "/.node-red/context",
            flushInterval: 30,
            sync: true
        }
    }
},
    // Add this to ensure contexts are saved before shutdown
    exitHandlers: [function() {
        console.log("Flushing persistent context storage before exit");
        try {
            const storage = RED.runtime.nodes.listContextStorage();
            if (storage && storage.persistent) {
                storage.persistent.emit('flush');
                console.log("Flushed persistent context storage");
            }
        } catch (e) {
            console.error("Error flushing context storage", e);
        }
    }]
};