/**
 * Base webpack config used across other specific configs
 */

import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import fs from 'fs';
import path from 'path';
import { detectNativeModules } from '../utils/native-detector.js';

/**
 * 智能获取externals配置
 * 优先从release/app/package.json读取，同时动态检测根目录的原生依赖
 */
function getExternals() {
  let releaseAppExternals = {};

  // 读取 release/app/package.json 中的依赖
  try {
    const releaseAppPkgPath = path.resolve(__dirname, '../../release/app/package.json');
    if (fs.existsSync(releaseAppPkgPath)) {
      const releaseAppPkg = JSON.parse(fs.readFileSync(releaseAppPkgPath, 'utf8'));
      releaseAppExternals = releaseAppPkg.dependencies || {};
    }
  } catch (error) {
    console.warn('Warning: Could not read release/app/package.json for externals');
  }

  // 使用统一的原生模块检测工具
  const rootNativeModules = detectNativeModules(path.resolve(__dirname, '../..'));

  // 合并externals配置
  const externals = { ...releaseAppExternals };

  // 将检测到的原生模块添加到externals
  rootNativeModules.forEach(module => {
    if (!externals[module]) {
      externals[module] = `commonjs ${module}`;
    }
  });

  console.log('Detected native modules for externals:', rootNativeModules);

  return Object.keys(externals);
}

const configuration: webpack.Configuration = {
  externals: getExternals(),

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
            },
          },
        },
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: { type: 'commonjs2' },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // There is no need to add aliases here, the paths in tsconfig get mirrored
    plugins: [new TsconfigPathsPlugins()],
  },

  plugins: [new webpack.EnvironmentPlugin({ NODE_ENV: 'production' })],
};

export default configuration;
