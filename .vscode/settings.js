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
    victronVirtual: {
        persistLocation: '/tmp/victron-test-location'
    }
};