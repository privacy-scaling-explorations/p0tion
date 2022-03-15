export default {
  rootDir: "./",
  collectCoverageFrom: ["**/src/index.ts", "!**/dist/**", "!**/node_modules/**"],
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: [".d.ts", ".js"],
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage/",
  coverageProvider: "v8",
  verbose: true,
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
}
