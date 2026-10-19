import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', '.vercel/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['server/**/*.js', 'api/**/*.js', 'dev.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
];
