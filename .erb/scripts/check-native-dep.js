import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';

const NPM_LS_COMMAND = 'npm ls --omit=dev --all --json --long';
const NATIVE_SCRIPT_PATTERN =
  /node-gyp|prebuild-install|node-pre-gyp|cmake-js|binding\.gyp|\.node\b/i;
const MAX_FINDINGS = 5;

function readProductionDependencyTree() {
  try {
    return JSON.parse(execSync(NPM_LS_COMMAND, { encoding: 'utf8' }));
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString();
    if (!output) {
      throw error;
    }
    return JSON.parse(output);
  }
}

function hasNativeInstallScript(scripts = {}) {
  return ['preinstall', 'install', 'postinstall'].some((scriptName) => {
    const script = scripts[scriptName];
    return typeof script === 'string' && NATIVE_SCRIPT_PATTERN.test(script);
  });
}

function packageHasNativeArtifacts(packageDir, nativeCache) {
  if (!packageDir || nativeCache.has(packageDir)) {
    return nativeCache.get(packageDir) || false;
  }

  let hasNativeArtifacts = false;

  try {
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.gypfile === true || hasNativeInstallScript(packageJson.scripts)) {
        hasNativeArtifacts = true;
      }
    }

    if (!hasNativeArtifacts) {
      const directoriesToScan = [packageDir];
      while (directoriesToScan.length > 0 && !hasNativeArtifacts) {
        const currentDir = directoriesToScan.pop();
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        entries.forEach((entry) => {
          if (hasNativeArtifacts || entry.name === 'node_modules') {
            return;
          }

          const entryPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            directoriesToScan.push(entryPath);
            return;
          }

          if (entry.name === 'binding.gyp' || entry.name.endsWith('.node')) {
            hasNativeArtifacts = true;
          }
        });
      }
    }
  } catch (error) {
    console.log(
      chalk.yellow(
        `Failed to inspect dependency for native artifacts: ${packageDir}`,
      ),
    );
    console.log(chalk.gray(String(error)));
  }

  nativeCache.set(packageDir, hasNativeArtifacts);
  return hasNativeArtifacts;
}

function collectNativeFindings(tree) {
  const findings = [];
  const nativeCache = new Map();
  const visited = new Set();

  function visitDependencies(dependencies = {}, ancestry = []) {
    Object.entries(dependencies).forEach(([name, dependency]) => {
      const packageDir = dependency?.path;
      const nextAncestry = [...ancestry, name];

      if (!packageDir) {
        visitDependencies(dependency?.dependencies, nextAncestry);
        return;
      }

      const visitKey = `${packageDir}:${nextAncestry[0] || name}`;
      if (visited.has(visitKey)) {
        return;
      }
      visited.add(visitKey);

      if (packageHasNativeArtifacts(packageDir, nativeCache)) {
        findings.push({
          chain: nextAncestry,
          packageDir,
        });
      }

      visitDependencies(dependency?.dependencies, nextAncestry);
    });
  }

  visitDependencies(tree.dependencies);
  return findings;
}

function formatFindings(findings) {
  return findings
    .slice(0, MAX_FINDINGS)
    .map(
      ({ chain, packageDir }) =>
        `- ${chalk.bold(chain.join(' -> '))}\n  ${chalk.gray(packageDir)}`,
    )
    .join('\n');
}

try {
  const dependencyTree = readProductionDependencyTree();
  const nativeFindings = collectNativeFindings(dependencyTree);

  if (nativeFindings.length === 0) {
    process.exit(0);
  }

  const remainingCount = nativeFindings.length - MAX_FINDINGS;
  const extraLine =
    remainingCount > 0
      ? `\n- ...and ${remainingCount} more native dependency chain${
          remainingCount > 1 ? 's' : ''
        }`
      : '';

  console.log(`
 ${chalk.whiteBright.bgYellow.bold(
   'Webpack does not work with native dependencies in the root app dependency tree.',
 )}
Native dependency chains found under "./package.json":
${formatFindings(nativeFindings)}${extraLine}

Move the top-level dependency that pulls in the native module to "./release/app/package.json" instead.
${chalk.whiteBright.bgGreen.bold('npm uninstall your-package')}
${chalk.whiteBright.bgGreen.bold(
  'cd ./release/app && npm install your-package',
)}

Read more about native dependencies at:
${chalk.bold(
  'https://electron-react-boilerplate.js.org/docs/adding-dependencies/#module-structure',
)}
 `);
  process.exit(1);
} catch (error) {
  console.log(chalk.yellow('Native dependencies could not be checked'));
  console.log(chalk.gray(String(error)));
}
