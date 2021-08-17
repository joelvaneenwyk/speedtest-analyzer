// https://eslint.org/docs/rules/
module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
    },
    ignorePatterns: [
        "/html/**", "/.yarn/**"
    ],
    settings: {},
    extends: ["plugin:prettier/recommended", "prettier"],
    rules: {
        "@typescript-eslint/no-var-requires": "off",
        "comma-dangle": ["error", "never"],
        "prettier/prettier": "off"
    }
};
