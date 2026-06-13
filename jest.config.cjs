/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }],
    '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }]
  },
  testMatch: ['**/tests/**/*.(test|spec).[jt]s'],
  testPathIgnorePatterns: ['/node_modules/', '/archive/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    'packages/**/*.ts',
    'apps/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ]
};

