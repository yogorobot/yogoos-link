/**
 * 原生模块检测工具
 * 提供绝对可靠的原生依赖检测方法
 * 唯一标准：检查模块是否包含 .node 文件
 */

import fs from 'fs';
import path from 'path';

/**
 * 检查指定路径是否包含 .node 文件
 * 无限递归扫描所有子目录
 *
 * @param {string} modulePath - 模块路径
 * @returns {boolean} 是否包含 .node 文件
 */
function hasNodeFiles(modulePath) {
  const scanForNodeFiles = (dirPath) => {
    try {
      const files = fs.readdirSync(dirPath);

      // 检查当前目录的 .node 文件
      if (files.some((file) => file.endsWith('.node'))) {
        return true;
      }

      // 检查子目录（无限递归）
      return files.some((file) => {
        const subPath = path.join(dirPath, file);
        try {
          if (fs.statSync(subPath).isDirectory() && !file.startsWith('.')) {
            return scanForNodeFiles(subPath);
          }
          return false;
        } catch {
          return false;
        }
      });
    } catch {
      // 忽略目录扫描错误
      return false;
    }
  };

  return scanForNodeFiles(modulePath);
}

/**
 * 绝对可靠的原生依赖检测
 * 唯一标准：检查模块是否包含 .node 文件
 *
 * @param {string} baseDir - 基础目录路径，默认为当前目录
 * @returns {string[]} 原生模块名称数组
 */
export function detectNativeModules(baseDir = '.') {
  const nodeModulesPath = path.resolve(baseDir, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    return [];
  }

  try {
    const folders = fs.readdirSync(nodeModulesPath).filter((folder) => {
      const fullPath = path.join(nodeModulesPath, folder);
      try {
        return fs.statSync(fullPath).isDirectory() && !folder.startsWith('.');
      } catch {
        return false;
      }
    });

    return folders.filter((folder) => {
      const modulePath = path.join(nodeModulesPath, folder);
      return hasNodeFiles(modulePath);
    });
  } catch (error) {
    console.warn('Warning: Failed to detect native modules:', error.message);
    return [];
  }
}

/**
 * 检查指定模块是否为原生模块
 *
 * @param {string} moduleName - 模块名称
 * @param {string} baseDir - 基础目录路径
 * @returns {boolean} 是否为原生模块
 */
export function isNativeModule(moduleName, baseDir = '.') {
  const modulePath = path.resolve(baseDir, 'node_modules', moduleName);

  if (!fs.existsSync(modulePath)) {
    return false;
  }

  return hasNodeFiles(modulePath);
}

/**
 * 获取原生模块的详细信息
 *
 * @param {string} baseDir - 基础目录路径
 * @returns {Object} 包含原生模块详细信息的对象
 */
export function getNativeModulesInfo(baseDir = '.') {
  const nativeModules = detectNativeModules(baseDir);
  const info = {
    count: nativeModules.length,
    modules: nativeModules,
    details: {},
  };

  nativeModules.forEach((moduleName) => {
    const modulePath = path.resolve(baseDir, 'node_modules', moduleName);
    const nodeFiles = [];

    // 收集所有 .node 文件路径（无限递归）
    const collectNodeFiles = (dirPath) => {
      try {
        const files = fs.readdirSync(dirPath);

        files.forEach((file) => {
          const filePath = path.join(dirPath, file);

          if (file.endsWith('.node')) {
            nodeFiles.push(path.relative(modulePath, filePath));
          } else {
            try {
              if (
                fs.statSync(filePath).isDirectory() &&
                !file.startsWith('.')
              ) {
                collectNodeFiles(filePath);
              }
            } catch {
              // 忽略错误
            }
          }
        });
      } catch {
        // 忽略错误
      }
    };

    collectNodeFiles(modulePath);

    info.details[moduleName] = {
      path: modulePath,
      nodeFiles,
    };
  });

  return info;
}

export { hasNodeFiles };
