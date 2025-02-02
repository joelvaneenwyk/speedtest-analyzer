import { CleanWebpackPlugin as CleanPlugin } from "clean-webpack-plugin";
import TsCheckerPlugin from "fork-ts-checker-webpack-plugin";
import { cpus } from "os";
import { Configuration, ProgressPlugin } from "webpack";
import merge from "webpack-merge";
import isProductionBuild from "./util/env";
import { paths, root } from "./util/paths";
import HtmlPlugin from "html-webpack-plugin";
import CssPlugin from "mini-css-extract-plugin";

const PnpPlugin = require("pnp-webpack-plugin");

console.log(`Starting ${isProductionBuild ? "production" : "development"} environment...`);

const frontend: Configuration = {
    entry: {
        speedtest: paths.source.frontend.app
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
                minifyJS: isProductionBuild,
                minifyCSS: isProductionBuild,
                minifyURLs: isProductionBuild
            },
            scriptLoading: "blocking",
            template: paths.source.frontend.template,
            templateParameters: {
                version: process.env.npm_package_version
            }
        }),
        new CssPlugin({
            filename: `static/css/[name].[contenthash].css`
        })
    ]
};

const config: Configuration = merge(
    {
        devServer: {
            contentBase: paths.public.html,
            hot: true,
            port: 3000
        },
        devtool: "source-map",
        mode: isProductionBuild ? "production" : "development",
        module: {
            rules: [
                {
                    test: /\.ts?$/,
                    use: [
                        {
                            loader: "thread-loader",
                            options: {
                                workers: cpus.length - 1,
                                poolTimeout: Infinity
                            }
                        },
                        {
                            loader: "ts-loader",
                            options: {
                                configFile: paths.config.tsconfig,
                                transpileOnly: true,
                                experimentalWatchApi: true,
                                happyPackMode: true
                            }
                        }
                    ]
                },
                {
                    enforce: "pre",
                    test: /\.js$/,
                    loader: "source-map-loader"
                }
            ]
        },
        node: {
            __dirname: true
        },
        output: {
            filename: isProductionBuild ? "static/js/[name].[contenthash].js" : "static/js/[name].js",
            path: paths.public.root,

            // Although the default, listing here explicitly because if this is true
            // then the data folder will be removed which is something we desperately
            // do not want to happen.
            clean: false
        },
        plugins: [
            new ProgressPlugin(),
            new TsCheckerPlugin({
                async: !isProductionBuild,
                typescript: {
                    diagnosticOptions: {
                        semantic: true,
                        syntactic: true
                    },
                    configFile: paths.config.tsconfig
                }
            }),
            new CleanPlugin({
                verbose: true,
                cleanStaleWebpackAssets: false,
                cleanOnceBeforeBuildPatterns: [`${paths.public.root}/*.html`, `${paths.public.root}/static/**/*`]
            })
        ],
        resolve: {
            extensions: [".tsx", ".ts", ".js"],
            plugins: [PnpPlugin]
        },
        resolveLoader: {
            plugins: [PnpPlugin.moduleLoader(module)]
        },
        stats: {
            warnings: false
        },
        target: "async-node",
        watch: !isProductionBuild
    } as Configuration,

    frontend as Configuration,

    {
        plugins: [
            {
                apply: (compiler) => {
                    compiler.hooks.done.tap("DonePlugin", (_stats) => {
                        if (isProductionBuild) {
                            setTimeout(() => {
                                console.log(`Compilation complete...`);

                                process.exit(0);
                            }, 0);
                        }
                    });
                }
            }
        ]
    } as Configuration
);

export default config;
