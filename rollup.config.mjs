import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

export default {
  input: 'src/nodes/victron-virtual-browser.js',
  output: {
    file: 'resources/victron-virtual-functions.js',
    format: 'iife'
  },
  plugins: [
    resolve(), // Resolves node_modules and file paths
    commonjs() // Converts CommonJS modules to ES6
  ]
}
