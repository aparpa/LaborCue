const path = require('path');

const coverageDirectory = path.resolve(process.env.COVERAGE_DIR || path.join(__dirname, 'coverage'));

module.exports = {
  preset: "react-native",
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.(spec|test).[jt]s?(x)",
    "**/?(*.)+(spec|test).[tj]s?(x)",
    "**/?(*.)+(test[0-9][0-9][0-9]).[tj]s?(x)",
    "**/?(*.)+(test[0-9][0-9][0-9][0-9]).[tj]s?(x)",
  ],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  coverageDirectory,
  coverageReporters: ["text", "html"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|react-native-chart-kit|react-native-svg|@testing-library)",
  ],
};
