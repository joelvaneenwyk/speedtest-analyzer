module.exports = {
    testEnvironment: "jsdom",
    // testEnvironment: require.resolve('jest-environment-node'),
    transformIgnorePatterns: ["/.pnp.js$"],
    setupFilesAfterEnv: ["<rootDir>/config/tools/jest-setup.js"],
    verbose: true,
    rootDir: "../../"
};
