# Claude Code JSONL 格式

## 概述

每行一条 JSON 记录，通过 `parentUuid` 构建消息树，`isSidechain` 标记子代理侧链。

## 记录类型

### `user` — 用户消息

```json
{
  "type": "user",
  "uuid": "唯一标识",
  "parentUuid": "父消息 UUID（null 表示根消息）",
  "isSidechain": false,
  "timestamp": "2026-07-01T10:00:00.000Z",
  "sessionId": "会话 ID",
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "消息内容" }]
  },
  "cwd": "工作目录",
  "gitBranch": "main",
  "version": "2.1.143"
}
```

### `assistant` — AI 回复

```json
{
  "type": "assistant",
  "uuid": "唯一标识",
  "parentUuid": "父消息 UUID",
  "isSidechain": false,
  "timestamp": "2026-07-01T10:00:03.000Z",
  "sessionId": "会话 ID",
  "message": {
    "role": "assistant",
    "model": "模型名称",
    "content": [
      { "type": "thinking", "thinking": "思考过程" },
      { "type": "text", "text": "文本回复" },
      { "type": "tool_use", "name": "Bash", "input": { "command": "ls" } },
      { "type": "tool_result", "name": "Bash", "content": "执行结果" }
    ],
    "usage": {
      "input_tokens": 1000,
      "output_tokens": 200,
      "cache_creation": { "ephemeral_1h_input_tokens": 500 },
      "cache_read_input_tokens": 100
    }
  }
}
```

#### content 块类型

| 类型 | 说明 |
|------|------|
| `text` | AI 文本回复 |
| `thinking` | AI 思考过程 |
| `tool_use` | 工具调用（含工具名和参数） |
| `tool_result` | 工具执行结果 |

### `attachment` — 附件（解析为 user 角色）

```json
{
  "type": "attachment",
  "uuid": "唯一标识",
  "parentUuid": "父消息 UUID",
  "isSidechain": false,
  "timestamp": "2026-07-01T10:00:01.000Z",
  "sessionId": "会话 ID",
  "attachment": {
    "type": "text",
    "content": "附件内容"
  }
}
```

### `system` — 系统记录

```json
{
  "type": "system",
  "uuid": "唯一标识",
  "sessionId": "会话 ID",
  "subtype": "turn_duration",
  "durationMs": 2500,
  "timestamp": "2026-07-01T10:00:03.500Z"
}
```

- `turn_duration` — 记录一次对话回合耗时

## 消息树结构

- `parentUuid: null` 为根消息
- 子消息的 `parentUuid` 指向父消息的 `uuid`
- 解析器按时间戳排序后平铺为线性列表
- 侧链消息（`isSidechain: true`）自动分组到父消息的 `sidechainMessages` 字段
