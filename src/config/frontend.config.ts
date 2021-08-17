/* eslint-disable prettier/prettier */
import HtmlPlugin from "html-webpack-plugin";
import CssPlugin from "mini-css-extract-plugin";
import { Configuration } from "webpack";
import isProductionBuild from "./util/env";
import { paths, root } from "./util/paths";

const PnpPlugin = require("pnp-webpack-plugin");

const frontend: Configuration = {
    entry: {
        "static/js/app": paths.source.frontend.app
    },

    resolve: {
        extensions: [".scss", ".tsx", ".ts", ".js"],
        plugins: [PnpPlugin]
    },
    resolveLoader: {
        plugins: [PnpPlugin.moduleLoader(module)]
    },

    module: {
        rules: [
            {
                test: /\.scss$/,
                use: [CssPlugin.loader, "css-loader", "sass-loader"]
            }
        ]
    },

    plugins: [
        new HtmlPlugin({
            chunks: ["static/js/app"],
            hash: true,
            meta: {
                description: "Speedtest Analyzer"
            },
            favicon: root("src/frontend", "favicon.ico"),
            inject: true,
            filename: "index.html",
            minify: {
                removeComments: isProductionBuild,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true
            },
            scriptLoading: "blocking",
            template: paths.source.frontend.template
        }),
        new CssPlugin({
            filename: `static/css/home.css`,
            chunkFilename: `static/css/home.chunk.css`
        })
    ]
};

export default frontend;
