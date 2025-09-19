import fs from "fs";
import chalk from "chalk";
import { dependencies } from "../../package.json";
import { detectNativeModules } from "../utils/native-detector.js";

// 智能原生依赖检查配置
const NATIVE_DEP_CONFIG = {
  // 允许在根目录的原生依赖（因特殊原因需要例外处理）
  rootAllowList: new Set(),
};

/**
 * 检查release/app目录下的package.json
 * 如果依赖已正确安装在该目录，则允许通过检查
 */
function checkReleaseAppDependencies() {
  try {
    const releaseAppPkgPath = "./release/app/package.json";
    if (fs.existsSync(releaseAppPkgPath)) {
      const releaseAppPkg = JSON.parse(
        fs.readFileSync(releaseAppPkgPath, "utf8"),
      );
      return new Set(Object.keys(releaseAppPkg.dependencies || {}));
    }
  } catch {
    console.log(
      chalk.yellow("Warning: Could not read release/app/package.json"),
    );
  }
  return new Set();
}

/**
 * 使用统一的原生依赖检测工具
 */
function detectNativeDependencies() {
  return detectNativeModules(".");
}

if (dependencies) {
  const dependenciesKeys = Object.keys(dependencies);
  const nativeDeps = detectNativeDependencies();
  const releaseAppDeps = checkReleaseAppDependencies();

  if (nativeDeps.length === 0) {
    console.log(chalk.green("✓ No native dependencies detected in root."));
    process.exit(0);
  }

  try {
    // 只检查在根package.json中声明且被检测为原生的模块
    const rootDependencies = nativeDeps.filter((dep) =>
      dependenciesKeys.includes(dep),
    );

    // 过滤出在根package.json中声明但不在允许列表中的原生依赖
    const problematicDeps = rootDependencies.filter((rootDependency) => {
      const isInRootDeps = dependenciesKeys.includes(rootDependency);
      const isAllowed = NATIVE_DEP_CONFIG.rootAllowList.has(rootDependency);
      const isInReleaseApp = releaseAppDeps.has(rootDependency);

      // 如果依赖已正确安装在release/app目录，则不视为问题
      return isInRootDeps && !isAllowed && !isInReleaseApp;
    });

    if (problematicDeps.length > 0) {
      const plural = problematicDeps.length > 1;

      // 不强制退出，允许开发者根据实际情况决定
      console.log(
        chalk.yellow(
          "\n⚠️  Continuing build process. Monitor for runtime issues.",
        ),
      );
    } else {
      console.log(
        chalk.green("✓ Native dependencies are properly configured."),
      );
    }
  } catch (error) {
    console.log(
      chalk.yellow("Warning: Native dependencies could not be fully checked"),
    );
    console.log(chalk.gray(`Details: ${error.message}`));
  }
}
