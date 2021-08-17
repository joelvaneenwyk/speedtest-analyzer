module.exports = {
    semi: true,
    trailingComma: "none",
    singleQuote: false,
    jsxSingleQuote: false,
    printWidth: 130,
    tabWidth: 4,
    overrides: [
        {
            files: ["**/*.json"],
            options: {
                tabWidth: 4,
                printWidth: 130,
                proseWrap: "preserve"
            }
        },
        {
            files: ["**/*.yml"],
            options: {
                tabWidth: 2,
                printWidth: 130,
                proseWrap: "preserve"
            }
        },
        {
            files: ["**/*.py"],
            options: {
                tabWidth: 4,
                printWidth: 130,
                proseWrap: "preserve"
            }
        },
        {
            files: ["**/*.md"],
            options: {
                tabWidth: 2,
                printWidth: 130,
                proseWrap: "preserve"
            }
        },
        {
            files: ["**/*.js"],
            options: {
                quoteProps: "consistent",
                singleQuote: "false",
                trailingComma: "none",
                tabWidth: 4,
                printWidth: 130,
                proseWrap: "preserve"
            }
        }
    ],
    plugins: [require("prettier-plugin-sh")]
};
