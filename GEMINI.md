# Yolink - 高级 SSH 工具套件

Yolink 是一款基于 **Electron**、**React 19** 和 **TypeScript** 构建的现代化跨平台桌面应用。它专为开发人员、系统管理员和 DevOps 专业人士设计，旨在简化 SSH 工作流程，提供直观的远程服务器管理、调试和日志查看体验。

## 🚀 项目概览

- **核心功能**:
  - **SSH 连接管理**: 安全连接远程服务器，支持直连和跳板机。
  - **远程调试**: 集成工具辅助远程应用调试。
  - **实时日志**: 强大的远程日志流查看与过滤功能。
  - **SSH 隧道**: 轻松管理安全端口转发。
  - **终端集成**: 内置基于 xterm.js 的高性能终端。
- **架构**: 遵循 Electron 的主进程（Main Process）与渲染进程（Renderer Process）分离架构。
  - **Main Process**: 负责窗口管理、SSH 连接维护、系统资源访问及 IPC 通信。
  - **Renderer Process**: 基于 React 的单页应用，负责 UI 展示与用户交互。

## 🛠️ 技术栈

- **框架**: Electron, React 19, TypeScript
- **样式**: Tailwind CSS 4, SCSS, CSS Modules
- **通信**: Electron IPC (V2 实现)
- **底层库**: 
  - `ssh2`: 处理 SSH 通信协议。
  - `xterm.js`: 提供终端仿真功能。
  - `electron-log`: 统一的日志记录。
- **构建工具**: Webpack, Electron Builder

## 📁 目录结构

- `src/main/`: 主进程代码
  - `managers/`: 核心逻辑管理器（SSH、窗口等）。
  - `events/`: IPC 事件处理器，定义主渲染进程间的通信接口。
- `src/renderer/`: 渲染进程（UI）代码
  - `components/`: 可复用的 React 组件。
  - `hooks/`: 封装了 SSH、日志、文件等业务逻辑的 React Hooks。
  - `pages/`: 页面组件（登录、首页、包管理、实时日志等）。
- `assets/`: 静态资源（图标、字体、Plist 文件等）。
- `.erb/`: Electron React Boilerplate 的构建与配置脚本。

## 🔧 关键命令

- **开发模式**: `npm start` (启动应用并开启热重载)
- **打包生产版本**: `npm run package` (构建并打包为当前平台的安装包，输出至 `release/build`)
- **构建**: `npm run build` (同时构建主进程和渲染进程)
- **代码检查**: `npm run lint` / `npm run lint:fix`
- **生成图标**: `npm run icons`
- **运行测试**: `npm test`

## 📝 开发规范

- **Git 提交**: 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，并使用 **中文** 消息。
- **代码风格**: 遵循项目中配置的 ESLint 和 Prettier 规则。
- **状态管理**: 倾向于使用 React Hooks 进行逻辑封装和状态管理。
- **IPC 通信**: 所有的跨进程通信应通过 `src/main/events` 中的处理器进行，并保持接口的一致性。
- **README 更新**: 每次重大逻辑变更后，务必同步更新项目文档。

---
*此 GEMINI.md 文件由 Gemini CLI 自动生成，作为未来交互的指令上下文。*
