const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

// Загружаем переменные окружения, если имеется файл .env
require('dotenv').config();

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|mp3|wav)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'assets/'
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html'
    }),
    // Определяем переменные окружения для браузера
    new webpack.DefinePlugin({
      'process.env': {
        // Предоставляем API URL или используем значение по умолчанию
        REACT_APP_API_URL: JSON.stringify(process.env.REACT_APP_API_URL || 'http://localhost:3001/api'),
        REACT_APP_WS_URL: JSON.stringify(process.env.REACT_APP_WS_URL || 'ws://localhost:3001'),
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
      }
    })
  ],
  devServer: {
    historyApiFallback: true,
    port: 3001,
    hot: true,
    open: true
  }
};