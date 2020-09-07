const path = require("path");
const CompressionPlugin = require("compression-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = {
  mode: "development",
  devtool: false,
  entry: {
    main: path.resolve(__dirname, 'src/peer/index.js'),
  },
  output: {
    path:  path.resolve(__dirname, 'dist'),
    filename: "peer-[contenthash:5].js",
  },
  externals: {
    "webrtc-adapter": "adapter"
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyPlugin({
      patterns: [
        {
          from: "node_modules/webrtc-adapter/out/adapter.js",
          to: "adapter-[contenthash:5].js",
        }
      ]
    }),
    new CompressionPlugin(),
  ]
}
