import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

export default {
  input: 'src/nodes/victron-virtual-functions.js',
  output: {
    file: 'test/fixtures/victron-virtual-functions.cjs',
    format: 'cjs',
    exports: 'named'
  },
  external: [], // No external dependencies to worry about
  plugins: [
    resolve({
      preferBuiltins: false // Don't try to resolve node built-ins
    }),
    commonjs({
      include: ['src/nodes/**'], // Apply to all files in src/nodes
      transformMixedEsModules: true // Handle mixed ES6/CommonJS
    })
  ]
}