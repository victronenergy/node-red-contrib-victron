// test/e2e/test-settings.js
const path = require('path')
const config = require('./config')

module.exports = {
  uiPort: config.nodeRed.port,
  uiHost: config.nodeRed.host,
  
  // Load the victron contrib nodes from src/
  nodesDir: [
    path.resolve(__dirname, '../../src/nodes')
  ],
  
  // Test-specific settings
  flowFile: 'flows-test.json',
  userDir: path.join(__dirname, '.node-red-test'),
  credentialSecret: 'test-secret-key',
  
  // Disable authentication for tests
  adminAuth: false,
  
  // Test logging configuration
  logging: config.nodeRed.logging,
  
  // Allow HTTP requests without authentication
  httpNodeAuth: false,
  httpStaticAuth: false,
  
  // Victron-specific test configuration
  victronVirtual: {
    persistLocation: path.join(__dirname, '.node-red-test/victron-persist-test')
  },

  // Enable CORS for testing
  httpNodeCors: {
    origin: "*",
    methods: "GET,PUT,POST,DELETE"
  },
  
  // Function global context for tests
  functionGlobalContext: {
    // Add test utilities if needed
  },
  
  // Editor theme (minimal for faster loading)
  editorTheme: {
    projects: { enabled: false },
    palette: { editable: false }
  }
}
