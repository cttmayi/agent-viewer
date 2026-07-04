# Codex JSONL 格式

## 概述

Codex CLI 的 JSONL 格式，以 `session_meta` 开头，后续为 `response_item` 记录，按时间戳排序。

## 记录类型

### `session_meta` — 会话元信息（文件首行）

```json
{
  "type": "session_meta",
  "timestamp": "2026-07-01T10:00:00.000Z",
  "payload": {
    "id": "会话 ID",
    "timestamp": "2026-07-01T10:00:00.000Z",
    "cwd": "/home/user/project",
    "originator": "codex-tui",
    "cli_version": "0.133.0",
    "source": "cli",
    "model_provider": "openai"
  }
}
```

### `response_item` — 消息

```json
{
  "type": "response_item",
  "timestamp": "2026-07-01T10:00:03.000Z",
  "payload": {
    "type": "message",
    "role": "user",
    "content": [
      { "type": "input_text", "text": "消息内容" }
    ]
  }
}
```

角色映射：

| 原始 role | 解析后 |
|-----------|--------|
| `user` | user |
| `assistant` | assistant |
| `developer` | system |

内容类型 `input_text` / `output_text` 统一映射为 `text`。

### `response_item` — 函数调用

```json
{
  "type": "response_item",
  "timestamp": "2026-07-01T10:00:05.000Z",
  "payload": {
    "type": "function_call",
    "name": "exec_command",
    "call_id": "exec-1",
    "arguments": "{\"cmd\": \"ls -la\"}"
  }
}
```

- 自动关联到前一条 assistant 消息的 `toolCalls` 字段
- `arguments` 为 JSON 字符串，解析为 `input` 对象

### `response_item` — 函数调用输出

```json
{
  "type": "response_item",
  "timestamp": "2026-07-01T10:00:06.000Z",
  "payload": {
    "type": "function_call_output",
    "call_id": "exec-1",
    "output": "命令输出内容"
  }
}
```

- 通过 `call_id` 匹配对应的 `function_call`
- 存储在 tool call 的 `result` 字段

### `turn_context` — 上下文信息（不参与消息显示）

```json
{
  "type": "turn_context",
  "timestamp": "2026-07-01T10:00:00.000Z",
  "payload": {
    "turn_id": "turn-001",
    "cwd": "/home/user/project",
    "approval_policy": "on-request",
    ...
  }
}
```

## 会话结构

- 按 `response_item` 的时间戳排序
- 消息通过顺序索引线性链接（无 `parentUuid`）
- `function_call` 自动附加到前一条 assistant 消息
- `function_call_output` 通过 `call_id` 匹配
