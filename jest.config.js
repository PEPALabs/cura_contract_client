/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: "node",
  testTimeout: 100000,
  transform: {
    "^.+.tsx?$": ["ts-jest", {tsconfig : 'tsconfig.json'}],
  },
  testPathIgnorePatterns: ["/dist/"],
};