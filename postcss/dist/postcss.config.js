module.exports = (ctx) => ({
  plugins: {
    'autoprefixer': {},
    'postcss-hash': {
      trim: 5,
      manifest: '/dev/null'
    }
  }
});
