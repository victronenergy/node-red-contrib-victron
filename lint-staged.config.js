module.exports = {
  '*.{js,jsx,ts,tsx}': [
    () => 'npm run build',
    () => 'npm run build:test',
    () => 'npm test'
  ],
  'src/nodes/*.html': [() => 'npm run documentation']
}
