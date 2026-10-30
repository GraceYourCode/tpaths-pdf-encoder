const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['.expo/**', 'node_modules/**', 'dist/**'],
    settings: { react: { version: '19.2' },}
  },
]);
