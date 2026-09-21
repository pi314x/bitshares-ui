// Minimal, standalone build for visually reviewing `app/next` screens in
// isolation (screenshots, design review) without booting the full legacy
// app shell (which blocks on a live blockchain connection before rendering
// anything — see AppInit.jsx). Not part of the real app build; see
// docs/UI_MIGRATION_PLAN.md Phase 0 ("Storybook or equivalent").
//
// Usage: yarn build-preview  (outputs to build/preview/)
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin").default;

const root_dir = path.resolve(__dirname);

module.exports = {
    mode: "development",
    entry: path.resolve(root_dir, "app/next/preview-entry.tsx"),
    output: {
        path: path.resolve(root_dir, "build/preview"),
        filename: "preview.js",
        clean: true
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"]
    },
    module: {
        rules: [
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
                                ],
                                [
                                    "@babel/preset-env",
                                    {targets: {browsers: ["last 2 versions"]}}
                                ]
                            ]
                        }
                    }
                ]
            },
            {
                test: /\.module\.scss$/,
                use: [
                    {loader: MiniCssExtractPlugin.loader},
                    {
                        loader: "css-loader",
                        options: {
                            modules: {
                                localIdentName: "[name]__[local]__[hash:base64:5]"
                            }
                        }
                    },
                    {loader: "sass-loader"}
                ]
            },
            {
                test: /\.scss$/,
                exclude: /\.module\.scss$/,
                use: [
                    {loader: MiniCssExtractPlugin.loader},
                    {loader: "css-loader"},
                    {loader: "sass-loader"}
                ]
            },
            {
                // @fontsource/* ships plain .css referencing its own .woff2.
                test: /\.css$/,
                use: [
                    {loader: MiniCssExtractPlugin.loader},
                    {loader: "css-loader"}
                ]
            },
            {
                test: /\.woff2?$/,
                type: "asset/inline"
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({filename: "preview.css"}),
        new HtmlWebpackPlugin({
            template: path.resolve(root_dir, "app/next/preview.html"),
            inject: true
        })
    ]
};
