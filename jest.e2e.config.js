// jest.e2e.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test/e2e/**/*.test.js',
    '!**/test/e2e/**/quick*.js' // Exclude quick test files
  ],
  testTimeout: 120000, // Increased to 2 minutes for e2e tests
  setupFilesAfterEnv: ['<rootDir>/test/e2e/setup.js'],
  globalSetup: '<rootDir>/test/e2e/global-setup.js',
  globalTeardown: '<rootDir>/test/e2e/global-teardown.js',
  // Handle async operations that might not close
  forceExit: true,
  detectOpenHandles: true
}
