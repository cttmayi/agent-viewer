# agent-viewer

本地 Web 工具，用于浏览和审查 Claude Code 和 Codex CLI 的对话历史记录。

[GitHub 仓库](https://github.com/cttmayi/agent-viewer)

## 功能

- **目录树浏览** — 按文件目录结构展示会话列表，支持展开/收起
- **会话详情** — 查看完整对话流，包含用户/AI/系统消息
- **统计摘要** — 消息数、Token 用量（输入/输出/缓存）、耗时、工具调用统计、模型用量
- **子代理侧链** — 自动识别并分组 `isSidechain=true` 的子对话
- **子代理面板** — 右侧独立面板查看子 agent 完整对话过程
- **格式支持**
  - Claude Code JSONL — 基于 `parentUuid` 的消息树构建、sidechain 提取
  - Codex JSONL — `session_meta` + `response_item` 格式
- **拖入文件** — 拖放 `.jsonl` 文件导入会话
- **文件监听** — chokidar 自动监听日志目录变更，WebSocket 实时推送到前端
- **设置面板** — 消息行数截断、Thinking/工具调用/侧链的折叠策略、主题切换
- **搜索过滤** — 按关键词筛选会话

## 快速开始

```bash
# 一行命令直接运行（自动安装 + 构建）
npx github:cttmayi/agent-viewer
```

或者 clone 到本地：

```bash
git clone https://github.com/cttmayi/agent-viewer.git
cd agent-viewer
npm install    # 自动构建前端
npm run dev
```

打开 http://localhost:3456。

## 开发模式（热更新）

需要同时启动两个进程：

```bash
# 终端 1: Express API 服务（端口 3456）
npm run dev

# 终端 2: Vite 前端开发服务器（端口 5173，支持热更新）
npm run dev:client
```

前端开发服务器运行在 http://localhost:5173，`/api` 和 `/ws` 请求自动代理到后端 3456 端口。

> 如果不需要热更新，`npm run build && npm run dev` 一个命令即可（Express 直接托管构建好的前端）。

## 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch
```

### 测试覆盖

| 模块 | 文件 | 用例数 |
|------|------|--------|
| Claude Code 解析器 | `tests/parsers/claude-code.test.js` | 21 |
| Codex 解析器 | `tests/parsers/codex.test.js` | 18 |
| 解析器注册 | `tests/parsers/registry.test.js` | 7 |
| 内存存储 | `tests/store.test.js` | 17 |
| 配置模块 | `tests/config.test.js` | 9 |
| 文件监听 | `tests/watcher.test.js` | 15 |
| WebSocket | `tests/websocket.test.js` | 5 |

## 配置

配置文件 `~/.agent-viewer/config.json` 在首次启动时自动生成。

### 日志目录

默认扫描以下目录：
- `~/.claude/projects`
- `~/.codex/sessions`

可在设置面板或配置文件中修改。

### 设置项

| 设置 | 可选值 | 说明 |
|------|--------|------|
| `messageMaxLines` | 0, 3, 5, 10, 15 | 消息文本截断行数（0 为全部显示） |
| `showThinking` | fold / unfold / hide | AI thinking 内容的显示策略 |
| `showToolCalls` | fold / unfold / hide | 工具调用详情的显示策略 |
| `showSidechains` | fold / unfold / hide | 子代理侧链的显示策略 |
| `theme` | system / light / dark | 主题 |

## 项目结构

```
agent-viewer/
├── client/                        # 前端 (React + Vite)
│   ├── src/
│   │   ├── components/            # React 组件
│   │   │   ├── Layout.jsx         # 双栏布局 + WebSocket 刷新
│   │   │   ├── Sidebar.jsx        # 侧边栏容器
│   │   │   ├── DirectoryTree.jsx  # 目录树
│   │   │   ├── DirectoryNode.jsx  # 可展开/收起的目录节点
│   │   │   ├── SessionNode.jsx    # 会话文件节点
│   │   │   ├── SearchBar.jsx      # 关键词搜索
│   │   │   ├── SettingsPanel.jsx  # 设置面板（模态框）
│   │   │   ├── DragDropOverlay.jsx# 拖入文件浮层
│   │   │   ├── MainArea.jsx       # 主区域容器
│   │   │   ├── WelcomeScreen.jsx  # 空状态引导页
│   │   │   ├── SessionView.jsx    # 会话详情容器
│   │   │   ├── StatsHeader.jsx    # 统计摘要栏
│   │   │   ├── MessageList.jsx    # 消息流容器
│   │   │   ├── UserMessage.jsx    # 用户消息气泡（左对齐，85% 宽度）
│   │   │   ├── AssistantMessage.jsx# AI 消息气泡（含模型/时间元数据）
│   │   │   ├── SystemMessage.jsx  # 系统消息
│   │   │   ├── ThinkingBlock.jsx  # thinking 折叠块
│   │   │   ├── ToolCallBlock.jsx  # 工具调用折叠块（含参数预览）
│   │   │   ├── SidechainGroup.jsx # 子代理侧链折叠组
│   │   │   └── SubagentPanel.jsx  # 右侧子 agent 面板
│   │   ├── hooks/
│   │   │   ├── useSettings.js     # 设置 API 读写
│   │   │   ├── SettingsContext.jsx # 设置上下文（全局共享）
│   │   │   ├── SubagentPanelContext.jsx # 子 agent 面板状态
│   │   │   └── useWebSocket.js    # WebSocket 连接管理
│   │   └── styles/
│   │       └── variables.css      # CSS 变量 + 主题
│   ├── index.html
│   └── vite.config.js
├── src/                           # 后端 (Express)
│   ├── index.js                   # 服务入口
│   ├── config.js                  # 配置读写
│   ├── store.js                   # 内存会话存储 + 目录树构建
│   ├── watcher.js                 # chokidar 文件监听
│   ├── websocket.js               # WebSocket 服务端
│   ├── parsers/
│   │   ├── registry.js            # 解析器自动检测
│   │   ├── claude-code.js         # Claude Code JSONL 解析器
│   │   └── codex.js               # Codex JSONL 解析器
│   └── routes/
│       ├── sessions.js            # GET /api/sessions/*
│       ├── config.js              # GET/PUT /api/config
│       └── upload.js              # POST /api/upload
├── tests/                         # 测试 (vitest)
│   ├── parsers/
│   │   ├── claude-code.test.js
│   │   ├── codex.test.js
│   │   └── registry.test.js
│   ├── config.test.js
│   ├── store.test.js
│   ├── watcher.test.js
│   └── websocket.test.js
└── docs/format/                   # 示例日志文件
    ├── claude-code.jsonl
    └── codex.jsonl
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/directory-tree` | 获取目录树结构 |
| GET | `/api/sessions/:fileId` | 获取会话详情（fileId 为 base64 编码的文件路径） |
| GET | `/api/config` | 获取当前配置 |
| PUT | `/api/config` | 更新配置 |
| POST | `/api/upload` | 上传 .jsonl 文件 |
| WS | `/ws` | WebSocket 实时推送（session-added / session-removed） |

## 数据格式

### Claude Code JSONL

使用 `parentUuid` 字段构建消息树，`isSidechain=true` 标记子代理侧链。

### Codex JSONL

使用 `session_meta` 记录会话元信息，`response_item` 承载消息内容，`developer` 角色自动映射为 `system`。
