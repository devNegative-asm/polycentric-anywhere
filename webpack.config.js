const path = require("path")
const webpack = require("webpack")
module.exports = {
    mode: "development",
    devtool: "source-map",
    optimization: {
        minimize: false
    },
    entry: {
      background: "./src/background/core.ts",
      content: "./src/index.tsx"
    },
    output: {
      path: path.resolve(__dirname, './dist'),
      filename: "[name]-task.js"
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|tsx|ts)$/,
          exclude: /node_modules/,
          loader: 'babel-loader'
        }
      ]
    }
  };