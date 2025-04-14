module.exports = {
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    }
  },
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}