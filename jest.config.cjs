const path = require('path');

const coverageDirectory = path.resolve(process.env.COVERAGE_DIR || path.join(__dirname, 'coverage'));

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.(spec|test).[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  coverageDirectory,
  coverageReporters: ['text', 'html'],
};
