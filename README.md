<div align="center">
  <img src="./assets/icon.png" alt="YOLINK Logo" width="150" />
  <h1>YOLINK</h1>
  <p><strong>您的高级 SSH 工具套件</strong></p>
  <p>一款专为开发人员、系统管理员和 DevOps 专业人士设计的现代化、功能强大且直观的 SSH 客户端。</p>
</div>

---

YOLINK 是一款基于 **Electron**、**React** 和 **TypeScript** 构建的跨平台桌面应用。它提供了丰富的用户界面和高级功能，可简化您的 SSH 工作流程，使远程服务器管理和调试比以往任何时候都更加轻松。

## ✨ 主要功能

- **SSH 连接管理**: 安全地连接到 SSH 服务器，支持直连和跳板机。
- **远程调试**: 集成工具，帮助调试在远程服务器上运行的应用程序。
- **日志查看**: 查看来自远程计算机的实时和历史日志，并具有强大的过滤功能。
- **SSH 隧道**: 轻松创建和管理用于安全端口转发的 SSH 隧道。
- **跨平台**: 在 macOS、Windows 和 Linux 上无缝运行。
- **现代化界面**: 使用 React 构建的干净、直观和响应迅速的用户界面。


## 🛠️ 技术栈

-   **核心技术**: Electron, React, TypeScript, Node.js
-   **样式**: SCSS, CSS Modules, Tailwind CSS
-   **构建与工具**: Webpack, ESLint, Prettier, Jest
-   **稳定性**: 内置 `boot.js` 引导程序，自动禁用有问题的 `sshcrypto` 原生模块以防止 ARM64 (macOS) 平台崩溃。

## 🚀 开发人员指南

### 环境要求

-   Node.js (版本要求请参见 `.nvmrc` 或 `package.json`，推荐 **v22**)
-   npm

### 安装步骤

1.  **克隆仓库。**

2.  **切换 Node 版本（建议）：**
    ```bash
    nvm use
    ```

3.  **安装依赖：**
    ```bash
    npm install
    ```

### 可用命令

-   **开发模式下运行：**
    启动应用并开启热重载。
    ```bash
    npm start
    ```

-   **打包生产版本：**
    为当前平台构建和打包应用。输出目录为 `release/build`。
    ```bash
    npm run package
    ```

-   **运行测试：**
    使用 Jest 执行测试套件。
    ```bash
    npm test
    ```

-   **代码检查：**
    检查代码中的格式错误。
    ```bash
    npm run lint
    ```

## 📁 项目结构

-   `.erb/`: 包含来自模板的构建系统配置、脚本和 Webpack 设置。
-   `src/main/`: 包含 Electron 主进程的代码（处理窗口管理、Node.js API 等）。
-   `src/renderer/`: 包含用户界面（UI）的 React 应用代码。
-   `assets/`: 包含图标和图片等静态资源。
-   `release/`: 包含打包后的应用和构建输出。

## 🤝 贡献代码

欢迎参与贡献！如有任何问题或建议，请随时提交 Issue 或 Pull Request。

## 📄 开源许可

本项目基于 MIT 许可开源。详情请参见 [LICENSE](LICENSE) 文件。
