var path = require("path");
var webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin").default;
var git = require("git-rev-sync");
require("es6-promise").polyfill();
const CopyWebpackPlugin = require("copy-webpack-plugin");
var locales = require("./app/assets/locales");
const HtmlWebpackPlugin = require("html-webpack-plugin");
var fs = require("fs");
// MCP (docs/MCP.md): whether the application has the MCP page and the review of
// transactions an AI assistant prepared. Off unless MCP_ENABLED (and MCP_TRADING_ENABLED
// for the review) is true in the environment or in the local settings file of the project's
// root (see the example file there).
const {loadEnvFile, buildFlags} = require("./mcp/src/env");
loadEnvFile(path.join(__dirname, ".env"), process.env, /^MCP_/);
const MCP = buildFlags(process.env);

/*
 * For staging builds, set the version to the latest commit hash, for
 * production set it to the package version
 */
// A build without a .git folder (a container build) takes what it is told (BRANCH, GIT_REV).
const fromGit = (read, fallback) => {
    try {
        return read();
    } catch (e) {
        return fallback;
    }
};
let branch = !!process.env.BRANCH
    ? process.env.BRANCH
    : fromGit(() => git.branch(), "unknown");
var __VERSION__ =
    branch === "develop"
        ? process.env.GIT_REV || fromGit(() => git.short(), "unknown")
        : require("./package.json").version;

// BASE APP DIR
var root_dir = path.resolve(__dirname);

module.exports = function(env) {
    // STYLE LOADERS
    var cssLoaders = [
        {
            loader: "style-loader"
        },
        {
            loader: "css-loader"
        },
        {
            loader: "postcss-loader"
        }
    ];

    var scssLoaders = [
        {
            loader: "style-loader"
        },
        {
            loader: "css-loader"
        },
        {
            loader: "postcss-loader"
        },
        {
            loader: "sass-loader"
        }
    ];

    // CSS Modules for the new design system (files named *.module.scss),
    // kept separate from the global, non-scoped SCSS used by legacy `app/`.
    var scssModuleLoaders = [
        {
            loader: "style-loader"
        },
        {
            loader: "css-loader",
            options: {
                modules: {
                    localIdentName: env.prod
                        ? "[hash:base64:8]"
                        : "[name]__[local]__[hash:base64:5]"
                }
            }
        },
        {
            loader: "postcss-loader"
        },
        {
            loader: "sass-loader"
        }
    ];

    // OUTPUT PATH
    var outputPath = path.join(root_dir, "assets").replace(/\\/g, "/");

    // COMMON PLUGINS
    const baseUrl = env.electron
        ? "./"
        : "baseUrl" in env
        ? env.baseUrl === "false"
            ? ""
            : env.baseUrl
        : "/";

    /*
     * moment and react-intl include tons of locale files, use a regex and
     * ContextReplacementPlugin to only include certain locale files
     */
    let regexString = "";
    locales.forEach((l, i) => {
        regexString = regexString + (l + (i < locales.length - 1 ? "|" : ""));
    });
    const localeRegex = new RegExp(regexString);
    var plugins = [
        new HtmlWebpackPlugin({
            template: "!!handlebars-loader!app/assets/index.hbs",
            templateParameters: {
                title: "BitShares Desk",
                description:
                    "BitShares Desk: balances, trading, liquidity pools, lending and more on the BitShares blockchain.",
                INCLUDE_BASE: !!env.prod && !env.hash,
                PRODUCTION: !!env.prod,
                ELECTRON: !!env.electron
            }
        }),

        new webpack.DefinePlugin({
            APP_VERSION: JSON.stringify(__VERSION__),
            __ELECTRON__: !!env.electron,
            __HASH_HISTORY__: !!env.hash,
            __BASE_URL__: JSON.stringify(baseUrl),
            __UI_API__: JSON.stringify(env.apiUrl),
            __TESTNET__: !!env.testnet,
            __DEPRECATED__: !!env.deprecated,
            // Deployment default for the exchange price chart: "auto" (TradingView
            // when its library is bundled, else the built-in chart), "tradingview"
            // or "lightweight". Users can still switch in the chart's own toggle.
            __CHART_ENGINE__: JSON.stringify(env.chartEngine || "auto"),
            DEFAULT_SYMBOL: "BTS",
            __GIT_BRANCH__: JSON.stringify(branch),
            __MCP_ENABLED__: MCP.enabled,
            __MCP_TRADING__: MCP.trading
        }),
        new webpack.ContextReplacementPlugin(
            /moment[\/\\]locale$/,
            localeRegex
        ),
        new webpack.ContextReplacementPlugin(
            /react-intl[\/\\]locale-data$/,
            localeRegex
        ),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.join(root_dir, "charting_library"),
                    globOptions: {
                        ignore: [
                            "**/*.zip",
                            "**/*.md5",
                            "**/*.swp",
                            "**/package.json",
                            "**/scss/**",
                            "**/package-charting-library.cjs",
                            "**/install-charting-library.cjs"
                        ]
                    },
                    to: "charting_library"
                }
            ]
        }),
        new webpack.ProvidePlugin({
            Buffer: ["buffer", "Buffer"]
        }),
        new webpack.ProvidePlugin({
            process: ["process", "process"]
        })
    ];
    if (env.prod) {
        // PROD OUTPUT PATH
        let outputDir = env.electron
            ? "electron"
            : env.hash
            ? !baseUrl
                ? "hash-history"
                : `hash-history_${baseUrl.replace("/", "")}`
            : "dist";
        outputPath = path.join(root_dir, "build", outputDir);

        // WRAP INTO CSS FILE
        cssLoaders = [
            {loader: MiniCssExtractPlugin.loader},
            {loader: "css-loader"},
            {loader: "postcss-loader"}
        ];
        scssLoaders = [
            {loader: MiniCssExtractPlugin.loader},
            {loader: "css-loader"},
            {loader: "postcss-loader"},
            {
                loader: "sass-loader",
                options: {sassOptions: {outputStyle: "expanded"}}
            }
        ];

        // PROD PLUGINS
        plugins.push(
            new webpack.DefinePlugin({
                "process.env": {NODE_ENV: JSON.stringify("production")},
                __DEV__: false
            })
        );
        plugins.push(
            new MiniCssExtractPlugin({
                filename: "[name].[contenthash].css"
            })
        );
    } else {
        plugins.push(
            new webpack.DefinePlugin({
                "process.env": {NODE_ENV: JSON.stringify("development")},
                __DEV__: true
            })
        );
        plugins.push(new webpack.HotModuleReplacementPlugin());
    }

    plugins.push(
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.posix.join(
                        path
                            .join(root_dir, "app", "assets", "locales")
                            .replace(/\\/g, "/"),
                        "*.json"
                    ),
                    to: path.join(outputPath, "[name][ext]"),
                    toType: "template"
                },
                {
                    from: path.join(
                        root_dir,
                        "app",
                        "lib",
                        "common",
                        "dictionary_en.json"
                    ),
                    to: path.join(outputPath, "dictionary.json"),
                    toType: "file"
                },
                {
                    from: path.join(
                        root_dir,
                        "app",
                        "assets",
                        "outdated_browser.css"
                    ),
                    to: path.join(outputPath, "outdated_browser.css"),
                    toType: "file"
                }
            ]
        })
    );

    /* Workaround in which the github pages server will find a file when it looks
    for /deposit-withdraw that will redirect to the hash router's equivalent
    /#/deposit-withdraw */

    if (env.hash)
        plugins.push(
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.join(
                            root_dir,
                            "app",
                            "components",
                            "DepositWithdraw",
                            "blocktrades",
                            "index.html"
                        ),
                        to: path.join(
                            outputPath,
                            "deposit-withdraw",
                            "index.html"
                        ),
                        toType: "file"
                    }
                ]
            })
        );
    var alias = {
        sanitize$: "xss",
        moment$: path.resolve(root_dir, "node_modules/moment/moment.js"),
        bitsharesjs$: path.resolve(root_dir, "node_modules/bitsharesjs/"),
        // Phase 8 (docs/UI_MIGRATION_PLAN.md): drop the `counterpart`
        // package in favor of a local, tested replacement covering the
        // exact subset of its API this app (and react-translate
        // -component, which imports `counterpart` internally) actually
        // uses. See app/lib/i18n/counterpartShim.js's header.
        counterpart$: path.resolve(root_dir, "app/lib/i18n/counterpartShim.js")
    };
    // The licensed TradingView library is not part of the repository. Without
    // it the import is aliased to an empty module (app/components/Exchange/
    // tradingViewMissing.js) so the build succeeds and the exchange shows the
    // built-in chart instead.
    if (
        !fs.existsSync(
            path.resolve(root_dir, "charting_library/charting_library.esm.js")
        )
    ) {
        alias["../../../charting_library/charting_library.esm$"] = path.resolve(
            root_dir,
            "app/components/Exchange/tradingViewMissing.js"
        );
    }
    var https = false;
    if (env.https) {
        https = {
            key: fs.readFileSync("./ssl/server.key"),
            cert: fs.readFileSync("./ssl/server.crt")
        };
    }
    var config = {
        mode: env.noUgly ? "none" : env.prod ? "production" : "development",
        entry: {
            app: path.resolve(root_dir, "app/Main.js")
        },
        output: {
            publicPath: env.prod ? "" : "/",
            path: outputPath,
            filename: env.prod ? "[name].[chunkhash].js" : "[name].js",
            chunkFilename: env.prod ? "[name].[chunkhash].js" : "[name].js",
            pathinfo: !env.prod,
            sourceMapFilename: "[name].js.map",
            globalObject: "this",
            clean: true
        },
        devServer: {
            hot: true,
            static: {
                directory: path.join(__dirname, "app/assets/locales"),
                publicPath: env.prod ? "" : "/"
            },
            // Every address of the app is index.html, also one with a dot in its last
            // part: a market of a gateway asset (/market/IOB.XRP_BTS) is not a file
            // (the default rule answers "Cannot GET" for it).
            historyApiFallback: {disableDotRule: true},
            https: https,
            // what a deployment sends too (docs/DEPLOYMENT.md); the policy itself is the page's meta tag
            headers: {
                "X-Content-Type-Options": "nosniff",
                "Referrer-Policy": "no-referrer"
            },
            devMiddleware: {
                index: true,
                mimeTypes: {phtml: "text/html"},
                publicPath: env.prod ? "" : "/"
            }
        },
        optimization: {
            splitChunks: {
                cacheGroups: {
                    styles: {
                        name: "styles",
                        test: /\.css$/,
                        chunks: "all",
                        enforce: true
                    },
                    vendor: {
                        name: "vendor",
                        test: /node_modules/,
                        chunks: "initial",
                        enforce: true
                    }
                }
            }
        },
        devtool:
            env.noUgly || !env.prod
                ? "inline-cheap-module-source-map"
                : "cheap-source-map",
        module: {
            rules: [
                {
                    // Test for a polyfill (or any file) and it won't be included in your
                    // bundle
                    test: /node-fetch/,
                    use: "null-loader"
                },
                {
                    test: /\.jsx$/,
                    include: [path.join(root_dir, "app")],
                    use: [
                        {
                            loader: "babel-loader",
                            options: {
                                presets: [
                                    [
                                        "@babel/preset-react",
                                        {targets: {node: "current"}}
                                    ]
                                ],
                                cacheDirectory: env.prod ? false : true
                            }
                        }
                    ]
                },
                {
                    test: /\.tsx?$/,
                    include: [path.join(root_dir, "app")],
                    use: [
                        {
                            loader: "babel-loader",
                            options: {
                                presets: [
                                    "@babel/preset-typescript",
                                    [
                                        "@babel/preset-react",
                                        {targets: {node: "current"}}
                                    ]
                                ],
                                cacheDirectory: env.prod ? false : true
                            }
                        }
                    ]
                },
                {
                    test: /\.js$/,
                    include: [path.join(root_dir, "app")],
                    use: [
                        {
                            loader: "babel-loader",
                            options: {
                                compact: false,
                                cacheDirectory: env.prod ? false : true,
                                presets: [
                                    [
                                        "@babel/preset-react",
                                        {targets: {node: "current"}}
                                    ]
                                ]
                            }
                        }
                    ]
                },
                {
                    test: /\.mjs$/,
                    include: /node_modules/,
                    type: "javascript/auto"
                },
                {test: /\.coffee$/, loader: "coffee-loader"},
                {
                    test: /\.(coffee\.md|litcoffee)$/,
                    loader: "coffee-loader",
                    options: {
                        literate: true
                    }
                },
                {
                    test: /\.css$/,
                    use: cssLoaders
                },
                {
                    test: /\.module\.scss$/,
                    use: scssModuleLoaders
                },
                {
                    test: /\.scss$/,
                    exclude: /\.module\.scss$/,
                    use: scssLoaders
                },
                {
                    test: /\.png$/,
                    exclude: [
                        path.resolve(root_dir, "app/assets/asset-symbols"),
                        path.resolve(
                            root_dir,
                            "app/assets/language-dropdown/img"
                        )
                    ],
                    // Asset module instead of url-loader: css-loader 6 turns
                    // `url(...)` into `new URL(...)`, which webpack 5 emits
                    // as an asset *after* running these loaders - so with
                    // url-loader the emitted file was its JS output
                    // (`export default "data:..."`), not the image. Same
                    // inline-below-100 kB rule as before.
                    type: "asset",
                    parser: {dataUrlCondition: {maxSize: 100000}}
                },

                {
                    // Asset module for the same reason as .png above. Fonts are
                    // always emitted as files (never inlined): the
                    // @fontsource stylesheets declare dozens of unicode-range
                    // subsets, and inlining them all would turn the CSS into
                    // a multi-megabyte blocking download instead of letting
                    // the browser fetch only the subsets a page uses.
                    test: /\.woff$/,
                    type: "asset/resource"
                },
                {
                    // @fontsource/ibm-plex-sans and @fontsource/ibm-plex-mono
                    // (docs/UI_MIGRATION_PLAN.md Phase 0) ship .woff2.
                    test: /\.woff2$/,
                    type: "asset/resource"
                },
                {
                    test: /.*\.svg$/,
                    exclude: [
                        path.resolve(root_dir, "app/assets/model-type-images"),
                        path.resolve(root_dir, "app/assets/bin-file")
                    ],
                    use: [
                        {
                            loader: "svg-inline-loader"
                        },
                        {
                            loader: "svgo-loader",
                            options: {
                                plugins: [
                                    {name: "cleanupAttrs", active: true},
                                    {name: "removeMetadata", active: true},
                                    {name: "removeXMLNS", active: true},
                                    {name: "removeViewBox", active: false}
                                ]
                            }
                        }
                    ]
                },
                {
                    test: /\.md/,
                    use: [
                        {
                            loader: "html-loader",
                            options: {sources: false}
                        },
                        {
                            loader: "markdown-loader",
                            options: {}
                        }
                    ]
                }
            ]
        },
        resolve: {
            modules: [
                path.resolve(root_dir, "app"),
                path.resolve(root_dir, "app/lib"),
                "node_modules"
            ],
            extensions: [".ts", ".tsx", ".js", ".jsx", ".coffee", ".json"],
            mainFields: ["module", "jsnext:main", "browser", "main"],
            alias: alias,
            fallback: {
                crypto: require.resolve("crypto-browserify"),
                constants: require.resolve("constants-browserify"),
                stream: require.resolve("stream-browserify"),
                path: require.resolve("path-browserify"),
                buffer: require.resolve("buffer")
            }
        },
        plugins: plugins
    };

    return config;
};
