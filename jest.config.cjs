const path = require('path');

const coverageDirectory = path.resolve(process.env.COVERAGE_DIR || path.join(__dirname, 'coverage'));

module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: { jsx: 'react-jsx' },
        isolatedModules: true,
        diagnostics: false,
      },
    ],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@testing-library/react-native|expo(nent)?|expo-.*|@expo(nent)?)/)',
  ],
  testMatch: [
    '**/__tests__/**/*.(spec|test).[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  coverageDirectory,
  coverageReporters: ['text', 'html'],
};
