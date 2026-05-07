# YOLINK SSH 连接集合 UI 规范

## 1. 目标

本规范用于指导后续将当前登录页重构为 SSH 连接集合页。目标是让用户打开应用后首先看到可管理多个 SSH 连接的集合界面，而不是直接进入单个登录表单。

## 2. 设计原则

- 保持当前深色、半透明、渐变的视觉语言，避免引入全新的设计风格。
- 优先使用项目已有 Tailwind 样式能力，减少自定义 CSS。
- 页面与组件必须按目录组织，样式使用 CSS Module 或已有 Tailwind class。
- 不使用 `:global` 覆盖样式。
- 密码类信息只在连接时临时输入，不展示、不持久化。
- 复杂页面必须拆分组件，单文件不得超过 500 行。

## 3. 信息架构

### 3.1 应用启动页

启动后默认进入 SSH 连接集合页，推荐路由为：

```text
/
/connections
```

集合页是用户进入应用后的第一屏，职责包括：

- 展示已保存的 SSH 连接。
- 新增 SSH 连接配置。
- 编辑已有 SSH 连接配置。
- 删除已有 SSH 连接配置。
- 发起 SSH 连接。
- 展示连接中、连接失败、连接成功等状态。

### 3.2 连接成功页

连接成功后进入现有功能首页：

```text
/home
```

现有日志、调试、系统、包管理、应用切换等功能仍从 `/home` 进入。

## 4. 页面布局

### 4.1 桌面端

推荐窗口尺寸：

```text
width: 900-960px
height: 640-720px
```

页面结构：

```text
顶部区域：产品标识、当前页面标题、主要操作按钮
主体区域：连接卡片列表或空状态
侧边/弹窗区域：新增或编辑 SSH 连接表单
底部区域：版本提示、连接数量、轻量帮助信息，可选
```

### 4.2 小窗口或窄屏

- 顶部操作按钮换行展示。
- 连接卡片从多列变为单列。
- 新增/编辑表单优先使用全屏抽屉或页面内表单，不使用过窄弹窗。
- 操作按钮保持最小点击区域不小于 `40px` 高。

## 5. 视觉规范

### 5.1 背景

延续当前应用风格：

- 主背景使用深色基底，例如 `bg-gray-900/85`。
- 可保留柔和渐变光斑，但不要影响内容可读性。
- 卡片使用半透明背景和细边框，例如 `bg-white/5`、`border-white/10`。

### 5.2 色彩

推荐语义色：

```text
主操作：indigo / cyan
成功：emerald
警告：amber
错误：red
次级信息：slate / white opacity
```

使用示例：

```text
主按钮：from-indigo-500 to-cyan-500
成功状态：text-emerald-300 / border-emerald-500/30
错误状态：text-red-300 / border-red-500/30
普通边框：border-white/10
```

### 5.3 字体与层级

- 页面标题：`text-2xl` 到 `text-3xl`，加粗。
- 卡片标题：`text-base` 到 `text-lg`，中粗。
- 辅助说明：`text-xs` 到 `text-sm`，使用 `text-white/60` 到 `text-white/70`。
- 表单标签：`text-sm`，使用 `text-white/80` 或更高对比度。

## 6. 连接卡片规范

### 6.1 卡片内容

每个连接卡片至少展示：

- 连接名称。
- 目标地址：`username@host:port`。
- 跳板机状态：直连或跳板机。
- 最近连接时间。
- 连接状态。

跳板机展示格式：

```text
直连：Direct
跳板机：jumpHost -> host
```

### 6.2 卡片操作

每张卡片提供以下操作：

- 连接。
- 编辑。
- 删除。

删除操作必须二次确认，避免误删。

### 6.3 状态展示

连接卡片需要支持以下状态：

```text
idle：未连接
connecting：连接中
connected：当前连接
failed：上次连接失败
```

状态表现：

- `connecting`：按钮显示加载态，禁止重复点击。
- `connected`：卡片显示绿色状态点或边框。
- `failed`：展示简短错误信息，错误详情不要挤占主布局。

## 7. 空状态规范

当没有任何 SSH 连接配置时，展示空状态。

空状态内容：

```text
标题：暂无 SSH 连接
说明：新增一个连接后即可管理机器人设备
主按钮：新增连接
```

空状态应居中展示，并保持与当前深色视觉一致。

## 8. SSH 表单规范

### 8.1 基础字段

新增或编辑 SSH 连接时，表单包含：

```text
连接名称
设备地址 host
端口 port
用户名 username
密码 password
```

字段规则：

- `host` 必填。
- `port` 必填，范围 `1-65535`，默认 `22`。
- `username` 必填，默认可沿用当前 `yogo`。
- `password` 只在连接时必填，不持久化。
- 编辑连接时密码输入框为空，提示用户连接时重新输入。

### 8.2 跳板机字段

跳板机配置默认折叠，通过开关启用。

启用后展示：

```text
跳板机地址 jumpHost
跳板机端口 jumpPort
跳板机用户名 jumpUsername
认证方式 jumpAuthType
跳板机密码 jumpPassword
跳板机私钥 jumpKeyFilePath
```

字段规则：

- `jumpHost` 必填。
- `jumpPort` 必填，范围 `1-65535`，默认建议为 `22`。
- `jumpUsername` 必填。
- `jumpAuthType` 支持 `password` 和 `key`。
- 选择密码认证时，`jumpPassword` 在连接时必填，不持久化。
- 选择私钥认证时，`jumpKeyFilePath` 必填，可持久化路径，不持久化私钥内容。

### 8.3 表单操作

新增模式：

```text
保存配置
保存并连接
取消
```

编辑模式：

```text
保存修改
连接
取消
```

连接动作必须进入加载态，连接完成前禁止重复提交。

## 9. 交互规范

### 9.1 新增连接

流程：

```text
点击新增连接 -> 打开表单 -> 填写配置 -> 保存 -> 回到连接集合
```

如果点击“保存并连接”，保存成功后立即发起 SSH 连接。

### 9.2 编辑连接

流程：

```text
点击编辑 -> 打开表单 -> 修改配置 -> 保存 -> 更新卡片
```

编辑时不回填任何密码字段。

### 9.3 删除连接

流程：

```text
点击删除 -> 二次确认 -> 删除配置 -> 更新列表
```

如果删除的是当前连接配置，需要先提示用户当前连接会被断开。

### 9.4 发起连接

流程：

```text
点击连接 -> 要求输入必要密码 -> 调用 SSH 认证 -> 成功进入 Home -> 失败显示错误
```

连接失败时保留用户仍在集合页，不自动跳转。

## 10. 持久化规范

推荐使用独立存储 key，避免继续沿用旧历史记录命名：

```text
yolink:ssh-connections
yolink:ssh-active-connection-id
```

允许持久化：

- 连接 ID。
- 连接名称。
- host。
- port。
- username。
- 跳板机配置。
- 私钥路径。
- 创建时间。
- 更新时间。
- 最近连接时间。

禁止持久化：

- 目标主机密码。
- 跳板机密码。
- 私钥文件内容。
- token 或其他敏感信息。

## 11. 组件拆分建议

推荐目录：

```text
src/renderer/pages/SshConnections/
  index.tsx
  SshConnections.module.css
  components/
    ConnectionCard.tsx
    ConnectionList.tsx
    ConnectionEmptyState.tsx
    SshConnectionForm.tsx
    JumpHostFields.tsx
    ConnectionPasswordDialog.tsx
  types.ts
  storage.ts
  validation.ts
```

组件职责：

```text
ConnectionCard：展示单个连接及其操作
ConnectionList：渲染连接集合
ConnectionEmptyState：无连接时的空状态
SshConnectionForm：新增和编辑连接表单
JumpHostFields：跳板机字段组
ConnectionPasswordDialog：连接前输入密码
storage：localStorage 读写
validation：字段校验和数据规范化
types：连接相关类型
```

## 12. 可访问性与可用性

- 所有按钮必须有明确文本或 `aria-label`。
- 删除、关闭、选择文件等图标按钮必须有 `title` 或 `aria-label`。
- 表单输入错误必须显示到对应字段附近或表单顶部。
- 禁用状态需要视觉可识别。
- loading 状态必须可识别，避免用户重复操作。

## 13. 验收标准

UI 完成后需要满足：

- 打开应用默认显示 SSH 连接集合页。
- 无连接时展示空状态。
- 可以新增连接配置。
- 可以编辑连接配置。
- 可以删除连接配置，并有二次确认。
- 可以从连接卡片发起连接。
- 连接成功后进入 `/home`。
- 连接失败时留在集合页并显示错误。
- 支持直连配置。
- 支持跳板机密码认证配置。
- 支持跳板机私钥认证配置。
- 密码不写入 localStorage。
- 窄屏或小窗口下布局不溢出。
- 单个页面或组件文件不超过 500 行。
