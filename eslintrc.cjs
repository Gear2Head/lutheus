module.exports = {
  root: true,
  env: {
    es2022: true,
    browser: true,
    node: true,
    jest: true
  },
  globals: {
    chrome: 'readonly'
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'off',
    'no-prototype-builtins': 'off',
    'no-useless-escape': 'off',
    'prefer-const': 'off',
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-var-requires': 'off'
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.min.js', 'webpack.*.js']
};
