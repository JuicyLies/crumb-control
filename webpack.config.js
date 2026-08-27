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
    // CSS files (referenced by manifest)
    { from: 'src/content/content.css', to: 'content.css' },
    { from: 'src/popup/popup.css', to: 'popup.css' },

    // Our rules
    { from: 'src/rules/', to: 'rules/', noErrorOnMissing: true },
    // Our source files (will be bundled by webpack entry points)
    { from: 'src/shared/', to: 'shared/', noErrorOnMissing: true },
    // Assets — icon_1024 is master artwork for store listings, not shipped
    {
      from: 'src/assets/',
      to: 'assets/',
      globOptions: { ignore: ['**/icon_1024.png'] },
      noErrorOnMissing: true
    },
    // MIT compliance: the built extension bundles Consent-O-Matic source, so the
    // upstream copyright notice must ship inside the distributed artifact too.
    { from: 'LICENSE', to: 'LICENSE', toType: 'file', noErrorOnMissing: true },
    { from: path.join(consentOMaticSrc, '..', 'LICENSE'), to: 'THIRD_PARTY_LICENSES/Consent-O-Matic-LICENSE', toType: 'file', noErrorOnMissing: true },
    // Consent-O-Matic rule database — the ONLY upstream artifact needed at runtime.
    // Declared in web_accessible_resources and fetched by the background service.
    { from: path.resolve(__dirname, 'Consent-O-Matic/BundledRules.json'), to: 'Rules.json', noErrorOnMissing: false },
  ];

  // NOTE: we deliberately do NOT copy the Consent-O-Matic Extension/ sources,
  // editor/, icons/, rules-list.json or rules.schema.json into the build.
  // webpack bundles ConsentEngine and its dependencies directly into content.js,
  // and the manifest loads only content.js + Rules.json. Shipping the raw sources
  // added ~200KB of dead weight and gave store reviewers unused code to query.
  // Verify with: grep -o '"js":\[[^]]*\]' dist/chrome/manifest.json
  
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
      }
    },
    devtool: isProduction ? false : 'inline-source-map',
    stats: 'minimal'
  };
};