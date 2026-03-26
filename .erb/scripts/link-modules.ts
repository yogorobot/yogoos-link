import fs from 'fs';
import webpackPaths from '../configs/webpack.paths';

const { srcNodeModulesPath, appNodeModulesPath, erbNodeModulesPath } =
  webpackPaths;

function ensureSymlink(target: string, linkPath: string) {
  try {
    fs.lstatSync(linkPath);
    fs.unlinkSync(linkPath);
  } catch {
    // linkPath does not exist, no need to remove
  }
  fs.symlinkSync(target, linkPath, 'junction');
}

if (fs.existsSync(appNodeModulesPath)) {
  ensureSymlink(appNodeModulesPath, srcNodeModulesPath);
  ensureSymlink(appNodeModulesPath, erbNodeModulesPath);
}
