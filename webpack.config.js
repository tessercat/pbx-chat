const path = require("path");
const CompressionPlugin = require("compression-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = {
  mode: "development",
  devtool: false,
  entry: {
    main: path.resolve(__dirname, 'src/index.js'),
  },
  output: {
    path:  path.resolve(__dirname, 'dist'),
    filename: "client-[contenthash:5].js",
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CompressionPlugin(),
  ]
}
