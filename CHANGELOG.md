# Changelog

All notable changes to this project will be documented in this file.

## [1.0.6] - 2026-03-31

### 🐛 问题修复 (Bug Fixes)
- **Core**: 彻底修复 `ssh2` 依赖的 `sshcrypto.node` 原生模块导致的 macOS/ARM64 硬件崩溃问题。
- **Stability**: 实现“物理忽略”方案，通过构建配置排除有问题组件。
- **Release**: 修复生产环境下 `boot.js` 引导程序无法正确寻找并加载业务 `main.js` 的路径解析错误。


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
