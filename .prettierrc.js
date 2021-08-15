module.exports = {
    semi: true,
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
