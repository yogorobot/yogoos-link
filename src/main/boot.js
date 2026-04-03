const Module = require('module');
const path = require('path');

/**
 * 1. 核心拦截逻辑：物理排除 + 逻辑补丁
 * 即使物理删除了文件，也要防止通过其他路径意外加载。
 */
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  // 拦截对 sshcrypto.node 的请求
  if (typeof request === 'string' && request.endsWith('sshcrypto.node')) {
    console.warn(`[Boot] 已成功拦截并忽略原生组件: ${request}`);
    // 返回空对象模拟加载失败但不出错，触发 ssh2 的 fallback
    return {};
  }
  // 确保使用正确的 context 调用
  return originalLoad.apply(Module, arguments);
};

// 预定义 __non_webpack_require__
const nodeRequire =
  typeof __non_webpack_require__ !== 'undefined'
    ? __non_webpack_require__
    : eval('require');

console.log('[Boot] SSH2 稳定性引导程序已启动。');

// 2. 加载核心业务逻辑
try {
  if (process.env.NODE_ENV === 'development') {
    // 开发环境下：加载 main.bundle.dev.js
    // 尝试多个可能路径，并使用 eval('require') 绕过 Webpack
    const devPath = path.resolve(
      __dirname,
      '../../.erb/dll/main.bundle.dev.js',
    );
    nodeRequire(devPath);
  } else {
    // 生产环境下：加载同级目录的 main.js
    // 在 ASAR 环境下，__dirname 指向 dist/main/
    const prodPath = path.resolve(__dirname, 'main.js');
    console.log(`[Boot] 正在从生产路径加载业务核心: ${prodPath}`);
    nodeRequire(prodPath);
  }
} catch (error) {
  console.error('[Boot] 关键模块加载失败:', error);
  // 提供更详细的错误以便调试
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error(`[Boot] 确认文件是否存在于 ASAR: ${error.message}`);
  }
  process.exit(1);
}
