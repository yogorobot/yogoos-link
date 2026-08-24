# Changelog

All notable changes to this project will be documented in this file.

## [1.2.2] - 2026-08-24

### ♻️ 变更与优化 (Changes)
- **Log**: 实时日志重构为统一在 `/var/run/log` 目录下检测 `meteor.log` 或 `macross.log`。
- **Log**: 历史日志根据探测到的日志类型动态匹配 `/var/log/meteor-*.gz` 或 `/var/log/macross-*.gz` 归档文件。
- **Log**: 日志过滤器动态适配默认搜索关键词（`macross` 默认为 `face_log`，`meteor` 默认为 `[Face]`），重置时自动恢复对应默认值。
- **Log**: 增强日志文件列表查询命令容错，避免远端无匹配归档文件时报命令退出码错误。

## [1.2.1] - 2026-08-24

### ♻️ 变更与优化 (Changes)
- **SSH**: 优化 SSH 连接集合页面交互与侧边栏展示。
- **UI**: 重构并优化 `SshConnectionForm` 连接配置表单与响应式样式。
- **Core**: 优化 SSH 认证管理与连接生命周期维护。

## [1.2.0] - 2026-05-19

### ✨ 新增功能 (Features)
- **SSH**: 引入全新的 SSH 连接集合管理器（`SshConnections`），支持多连接配置持久化、新增、编辑、删除与一键连接。
- **IPC**: 增加针对多连接管理的主渲染进程通信事件通道与存储支持。

## [1.1.0] - 2026-05-09

### ✨ 新增功能 (Features)
- **Tray**: 系统托盘增强，支持点击动态刷新托盘菜单，并实时展示活跃的 SSH 连接列表。
- **Tray**: 优化窗口关闭行为，支持关闭主窗口时自动最小化/隐藏至系统托盘。
- **Updater**: 增加完整的应用发布与更新流程，支持手动下载及资产上传校验。

### 🎨 样式与交互 (UI & UX)
- **UI**: 全局滚动条样式轻量化优化（Slim scrollbars）。
- **Refactor**: Yolink 核心代码架构重构与性能调优。

## [1.0.6] - 2026-03-31

### 🐛 问题修复 (Bug Fixes)
- **Core**: 彻底修复 `ssh2` 依赖的 `sshcrypto.node` 原生模块导致的 macOS/ARM64 硬件崩溃问题。
- **Stability**: 实现“物理忽略”方案，通过构建配置排除有问题组件。
- **Release**: 修复生产环境下 `boot.js` 引导程序无法正确寻找并加载业务 `main.js` 的路径解析错误。

## [1.0.5] - 2026-03-30

### 🐛 问题修复 (Bug Fixes)
- **macOS**: 添加 macOS 权限配置，修复未用苹果证书签名时的不同 Team ID 崩溃问题。
- **CI/CD**: 修复 GitHub Actions 存储限制，直接上传构建产物到 Release。
- **Build**: 升级 `electron-builder` 并优化构建流程，解决 Python 3.12+ 兼容性与符号链接问题。
- **Deps**: 规范化 `packageManager` 配置以解决 Dependabot 解析错误。

## [1.0.4] - 2025-12-08

### ♻️ 变更与优化 (Changes)
- **Style**: 移除 SASS 依赖，全面引入 Tailwind CSS 作为基础样式引擎。
- **Build**: 更新 Webpack 配置以支持 Tailwind 样式编译。
- **Lint**: 优化代码风格，调整 ESLint 配置并清理冗余配置。

## [1.0.3] - 2025-12-08

### 📝 文档 (Documentation)
- **Docs**: 建立并规范项目的 Changelog 文档。

## [1.0.2] - 2025-12-08

### ✨ 新增功能 (Features)
- **UI**: 添加侧边栏折叠功能，提供更大的操作空间 (72feb88)

### 🐛 问题修复 (Bug Fixes)
- **Core**: 修复登录后 `authInfo` 偶尔为空导致功能按钮不可用的严重问题 (b23d3f2)
- **UI**: 修复部分样式显示问题 (ae0a460)
- **UI**: 修复关于页面的显示问题 (6995241)
- **System**: 修复系统托盘 (Tray) 相关问题 (88fd93a)
- **Text**: 修正部分文案错误 (1327d73)

### ♻️ 变更与优化 (Changes)
- **UI**: 移除默认标题栏，采用自定义窗口控制 (febcb65)
- **Feature**: 移除存储格式化功能 (235cf5b)

## [1.0.0] - 2025-09-25

### 🚀 初始版本 (Initial Release)
- **Core**: Yolink 基础架构搭建，基于 Electron、React 与 TypeScript。
- **SSH**: 提供 SSH 连接管理、远程终端、实时日志与调试功能。
