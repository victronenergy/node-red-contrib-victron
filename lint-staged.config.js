module.exports = {
  '*.{js,jsx,ts,tsx}': [
    () => 'npm run build',
    () => 'npm run build:test',
    'standard --fix',
    () => 'npm test'
  ],
  'src/nodes/*.html': [() => 'npm run documentation']
}
