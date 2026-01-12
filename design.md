# 设计：重构为 Claude Agent SDK Web UI

## 目标

- 通过命令行参数指定 Agent 目录启动，并在该目录上创建 Claude Agent，可传入初始 Prompt（可为空）。
- 启动后提供 Web 页面（浏览器中访问），用户可与该 Agent 持续对话。
- 单会话（只有一个 session），不提供 session 管理或历史会话切换。
- Web 页面可查看对应 Agent 目录信息。

## 非目标

- 多 Agent、多会话历史或会话持久化。
- 重做 Claude Agent SDK 运行时、工具或技能编译链路。

## 现状简述（用于迁移参考）

- Electron 主进程通过 `query()` + message queue 驱动 Claude Agent SDK 流式输出。
- Workspace 路径来自 config（`getWorkspaceDir()`），作为 Agent `cwd`。
- Renderer 提供聊天 UI、设置、会话历史（本地 JSON）。
- IPC 包含 `chat:*`、`conversation:*`、`config:*` 等。

## 目标用户流程

1. 服务启动时，用户通过参数指定 Agent 目录，（可选）通过命令行参数传入初始 Prompt。
2. 服务监听 Web 端口。
3. 如果传入了初始 Prompt，直接启动 Agent；否则需要用户输入 Prompt 并点击运行，然后进入聊天界面。
4. 用户持续与 Agent 对话（单会话）。
5. 界面展示 Agent 目录信息（摘要 + 目录树）。
6. 不考虑任何会话管理，仅支持单会话。

## 方案概览（Web 服务化）

### 服务进程（Node/HTTP）

新增一个“Agent 会话管理器”负责：

- `agentDir`: 当前 Agent 目录（绝对路径）
- `initialPrompt`: 可选 Prompt
- `sessionState`: idle | running | error

职责：

- 读取并校验命令行参数中的 Agent 目录。
- 使用 `cwd = agentDir` 启动 Claude Agent SDK 会话。
- 若存在初始 Prompt，作为第一条 user message 入队。
- 提供轻量“重启”能力（可选），仅在同一目录内重启单会话。

变更要点：

- `claude-session` 不再依赖 `getWorkspaceDir()`，改为使用当前 `agentDir`。
- 移除恢复会话逻辑与 session ID 持久化。
- 移除会话历史存储与相关 handler（`conversation-db`、`conversation-handlers`）。

### Web API（HTTP/SSE）

核心接口（最小集）：

- `POST /chat/send` -> 发送用户消息；若会话尚未启动则自动启动并将该消息作为首条 Prompt。
- `GET /chat/stream` -> 流式消息（SSE），包含初始化信息与历史消息。
- `GET /agent/dir` -> 目录摘要 + 树形数据（限深度）。
- `POST /chat/stop` -> 中断当前响应（可选）。

### SSE 交互协议（建议实现）

连接：

- `GET /chat/stream`，`Accept: text/event-stream`，单会话持续连接。

发送：

- `POST /chat/send`，body: `{ "text": string }`（建议校验非空）。
- 响应结构与现有 `SendMessageResponse` 保持一致：`{ success, error?, attachments? }`。

事件类型（Server-Sent Events，严格对齐现有 IPC 事件名与 payload 结构）：

- `event: chat:init`，`data: { "agentDir": string, "sessionState": "idle" | "running" | "error", "hasInitialPrompt": boolean }`
- `event: chat:message-replay`，`data: { "message": MessageWire }`
- `event: chat:message-chunk`，`data: string`
- `event: chat:thinking-start`，`data: { "index": number }`
- `event: chat:thinking-chunk`，`data: { "index": number, "delta": string }`
- `event: chat:tool-use-start`，`data: { "id": string, "name": string, "input": object, "streamIndex": number }`
- `event: chat:tool-input-delta`，`data: { "index": number, "toolId": string, "delta": string }`
- `event: chat:content-block-stop`，`data: { "index": number, "toolId"?: string }`
- `event: chat:tool-result-start`，`data: { "toolUseId": string, "content": string, "isError": boolean }`
- `event: chat:tool-result-delta`，`data: { "toolUseId": string, "delta": string }`
- `event: chat:tool-result-complete`，`data: { "toolUseId": string, "content": string, "isError"?: boolean }`
- `event: chat:message-complete`，`data: null`
- `event: chat:message-stopped`，`data: null`
- `event: chat:message-error`，`data: string`
- `event: chat:debug-message`，`data: string`
- `event: chat:status`，`data: { "sessionState": "idle" | "running" | "error" }`

MessageWire 数据结构（对齐现有前端 Message 结构）：

- `id`: string
- `role`: "user" | "assistant"
- `content`: string | ContentBlock[]
- `timestamp`: string（ISO 8601，与现有存储格式一致）
- `attachments?`: { id, name, size, mimeType, savedPath?, relativePath?, previewUrl?, isImage? }[]

ContentBlock 结构（对齐现有前端）：

- `type`: "text" | "tool_use" | "thinking"
- `text?`: string
- `thinking?`: string
- `thinkingStartedAt?`: number
- `thinkingDurationMs?`: number
- `thinkingStreamIndex?`: number
- `isComplete?`: boolean
- `tool?`: { id, name, input, streamIndex, inputJson?, parsedInput?, result?, isLoading?, isError? }

时序示例：

1. 客户端建立 `/chat/stream` 连接。
2. 服务端推送 `chat:init`，随后逐条推送 `chat:message-replay`（全量历史）。
3. 客户端 `POST /chat/send`。
4. 服务端推送多个 `chat:message-chunk`，必要时穿插 `chat:thinking-*`、`chat:tool-*` 事件。
5. 服务端推送 `chat:message-complete`。

说明：

- SSE 连接在服务端保持单例（单会话），断线自动重连可由浏览器 `EventSource` 处理。
- 若服务启动时带初始 Prompt，服务端直接入队并通过 SSE 推流。
- 若未带初始 Prompt，Web UI 首次调用 `POST /chat/send` 即启动会话并开始推流。

### Web UI

页面仅保留核心功能：

1. 启动页（仅在未传入初始 Prompt 时显示）

- Prompt 输入框。
- 运行按钮与错误提示。

2. Chat 页

- 消息列表 + 输入框。
- 目录信息面板（摘要 + 目录树）。
- 会话状态指示（idle/running/error）。
- 可选“重启 Agent”按钮。

### 目录信息载荷

- `root`: string（绝对路径）
- `summary`: { totalFiles, totalDirs }
- `entries`: array of
  - `path`: string（相对 root）
  - `type`: "file" | "dir"
  - `depth`: number
- `truncated`: boolean（是否因限制被截断）

限制：

- 限制最大深度（例如 3）与最大条目（例如 500）。
- 忽略 `.git`、`node_modules`、`out`、`dist`、`tmp`。
- 所有路径必须归一化并限制在 `agentDir` 内。

## 配置与默认值

- `agentDir` 与 `initialPrompt` 由命令行参数提供，`agentDir` 为必填。
- 若未传入初始 Prompt，需通过 Web UI 提交后启动会话。
- API Key 配置保持现有逻辑。

## 核心数据流

1. 服务启动时从命令行读取 `agentDir` 与可选 `initialPrompt`。
2. 若有初始 Prompt，服务直接启动会话并入队首条消息。
3. 若无初始 Prompt，Web UI 通过 `POST /chat/send` 提交 Prompt 后启动会话。
4. Web UI 拉取 `GET /agent/dir` 渲染目录面板。
5. 用户 `POST /chat/send`，通过 `GET /chat/stream` 接收流式响应。

## 重构步骤（最小可用）

1. 抽出 Agent 会话管理器（单会话）。
2. `claude-session` 改为使用命令行指定的 `agentDir` 启动。
3. 删除会话历史相关模块与 UI。
4. 新增 Web API 与 Web UI（启动页 + Chat 页）。
5. 增加目录信息接口与面板。

## 风险与缓解

- 目录过大：限制深度与条目数量，并标记 `truncated`。
- 路径非法：服务端校验并返回明确错误信息。
- Agent 长时间运行：保留“停止响应”能力与状态提示。

## 页面刷新与多开逻辑

- 核心原则：服务端仅维护一个 Agent 会话；多个页面共享同一会话状态与消息流。
- 页面刷新：前端重连 SSE 后，先接收全量 `chat:message-replay`，再继续接收增量。
- 多页面：每个页面独立建立 SSE 连接，服务端广播同一流式消息；不影响会话本身。
- 消息存储：服务端保留内存中的消息列表（仅当前会话），用于刷新/新开页面重建 UI。
- 断线重连：SSE 断线后自动重连；可使用 `Last-Event-ID` 或消息序号避免丢失。
