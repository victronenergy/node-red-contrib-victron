import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

export default [
  {
    input: 'src/nodes/victron-virtual-browser.js',
    output: {
      file: 'resources/victron-virtual-functions.js',
      format: 'iife'
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  },
  {
    input: 'src/nodes/victron-common.js',
    output: {
      file: 'resources/victron-common.js',
      format: 'iife',
      name: 'victronCommon'
    },
    plugins: [
      resolve(),
      commonjs()
    ]
  }
]
