const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlMinimizerPlugin = require('html-minimizer-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const glob = require('glob');

module.exports = (env, argv) => {
  const target = env.target || 'chrome';
  const isProduction = argv.mode === 'production';
  const isFirefox = target === 'firefox';
  const isSafari = target === 'safari';
  
  const distDir = path.resolve(__dirname, `dist/${target}`);
  const consentOMaticSrc = path.resolve(__dirname, 'Consent-O-Matic/Extension');
  const pkg = require('./package.json');
  
  // Build copy patterns dynamically
  const copyPatterns = [
    // Our manifest (transformed)
    { 
      from: 'src/manifest.json', 
      to: 'manifest.json', 
      transform: (content) => {
        const manifest = JSON.parse(content.toString());
        manifest.version = pkg.version;
        if (isFirefox) {
          delete manifest.declarative_net_request;
          manifest.background = { scripts: ['background.js'], type: 'module' };
        }
        return JSON.stringify(manifest, null, 2);
      }
    },
    // HTML files (referenced by manifest)
    { from: 'src/popup/popup.html', to: 'popup.html' },
    { from: 'src/options/options.html', to: 'options.html' },
    // CSS files (referenced by manifest)
    { from: 'src/content/content.css', to: 'content.css' },
    { from: 'src/popup/popup.css', to: 'popup.css' },
    { from: 'src/options/options.css', to: 'options.css' },
    // Our rules
    { from: 'src/rules/', to: 'rules/', noErrorOnMissing: true },
    // Our source files (will be bundled by webpack entry points)
    { from: 'src/shared/', to: 'shared/', noErrorOnMissing: true },
    // Assets
    { from: 'src/assets/', to: 'assets/', noErrorOnMissing: true },
    // Consent-O-Matic files
    { from: path.join(consentOMaticSrc, 'Rules.json'), to: 'Rules.json', noErrorOnMissing: true },
    { from: path.join(consentOMaticSrc, 'rules-list.json'), to: 'rules-list.json', noErrorOnMissing: true },
    { from: path.join(consentOMaticSrc, 'rules.schema.json'), to: 'rules.schema.json', noErrorOnMissing: true },
    // Copy JS files from Consent-O-Matic Extension (but not the ones we bundle)
    { 
      from: consentOMaticSrc, 
      to: '', 
      globOptions: {
        ignore: ['**/*.js', '**/*.html', '**/*.scss', '**/*.css', '**/icons/**', '**/editor/**', '**/Rules.json', '**/rules-list.json', '**/rules.schema.json', '**/manifest*.json', '**/webpack.config.js', '**/package*.json', '**/LICENSE', '**/README.md', '**/.gitignore', '**/.vscode/**']
      },
      noErrorOnMissing: true
    },
    { from: path.join(consentOMaticSrc, 'icons/'), to: 'icons/', noErrorOnMissing: true },
    { from: path.join(consentOMaticSrc, 'editor/'), to: 'editor/', noErrorOnMissing: true },
  ];
  
  // Firefox-specific: need to copy manifest.firefox.json as manifest.json
  if (isFirefox) {
    copyPatterns.unshift({
      from: 'src/manifest.firefox.json',
      to: 'manifest.json',
      transform: (content) => {
        const manifest = JSON.parse(content.toString());
        manifest.version = pkg.version;
        manifest.background = { scripts: ['background.js'], type: 'module' };
        return JSON.stringify(manifest, null, 2);
      }
    });
  }
  
  return {
    entry: {
      background: './src/background/background.js',
      content: './src/content/content.js',
      popup: './src/popup/popup.js',
      options: './src/options/options.js',
    },
    output: {
      path: distDir,
      filename: '[name].js',
      clean: true,
      module: true,
    },
    experiments: {
      outputModule: true,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: { browsers: ['last 2 chrome versions', 'last 2 firefox versions'] }, modules: false }]
              ]
            }
          }
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'sass-loader'
          ]
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ]
        }
      ]
    },
    plugins: [
      new CopyPlugin({
        patterns: copyPatterns
      }),
      new MiniCssExtractPlugin({
        filename: '[name].css'
      }),
      ...(isProduction ? [
        new ZipPlugin({
          filename: `udp-${target}-v${pkg.version}.zip`,
          path: path.resolve(__dirname, 'dist'),
        })
      ] : [])
    ],
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            ecma: 2020,
            module: true,
            compress: { drop_console: false },
            mangle: { module: true }
          },
          extractComments: false
        }),
        new CssMinimizerPlugin(),
        new HtmlMinimizerPlugin()
      ]
    },
    resolve: {
      extensions: ['.js', '.json'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@background': path.resolve(__dirname, 'src/background'),
        '@content': path.resolve(__dirname, 'src/content'),
        '@popup': path.resolve(__dirname, 'src/popup'),
        '@options': path.resolve(__dirname, 'src/options'),
      }
    },
    devtool: isProduction ? false : 'inline-source-map',
    stats: 'minimal'
  };
};