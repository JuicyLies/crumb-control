export default [{
  files: ['src/**/*.js'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: Object.fromEntries([
    'chrome', 'window', 'document', 'console', 'URL', 'Blob', 'MutationObserver',
    'PerformanceObserver', 'performance', 'location', 'crypto', 'fetch', 'confirm',
    'alert', 'Event', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame'
  ].map(name => [name, 'readonly'])) },
  rules: { 'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-keys': 'error',
    'no-constant-condition': 'error', 'valid-typeof': 'error' }
}];
