# UI 与设计规范

## 1. 基础体系
- **UI 框架 / 样式引擎**: Tailwind CSS 4 + SCSS / CSS Modules
- **技术栈**: React 19 + TypeScript + Electron
- **设计风格**: 现代化深色系（Dark Mode）桌面应用质感

## 2. 布局与交互规范
- **弹窗 / 模态框规范**:
  - 禁止遮罩层（Overlay）产生页面级滚动；
  - 弹窗面板结构固定为三段式：
    - `Header`: 固定顶部（`shrink-0`，包含标题、副标题与关闭/取消操作）；
    - `Body`: 中间区域自适应并支持内部独立滚动（`flex-1 overflow-y-auto`）；
    - `Footer`: 固定底部（`shrink-0`，包含次要操作与主要操作按钮）；
  - 弹窗最大高度限制在视口安全区域内（`max-h-[calc(100vh-var(--yogo-titlebar-safe-height)-2.5rem)]`）。
- **表单排版规范**:
  - 网格表单同一行的两列需具备对称的 DOM 结构与错误提示占位，防止高度不一致导致视觉错位；
  - 输入框统一使用 `yogo-input`，主要按钮使用 `yogo-button-primary`，次要按钮使用 `yogo-button-secondary`。

## 3. 代码约束
- 禁止使用 `:global` 强行覆盖组件/框架样式；
- 样式通过 props、Tailwind 类名及 CSS Module 组织；
- 保持组件单一职责与结构清晰。

