import React, { useState } from 'react';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';
import { useSubagentPanel } from '../hooks/SubagentPanelContext.jsx';

const TOOL_KEY_PARAMS = {
  Bash: 'command',
  Read: 'file_path',
  Write: 'file_path',
  Edit: 'file_path',
  Glob: 'pattern',
  Grep: 'pattern',
  Agent: 'prompt',
  WebSearch: 'query',
  WebFetch: 'url',
  TaskCreate: 'subject',
  TaskUpdate: 'taskId',
  Skill: 'skill',
  exec_command: 'cmd',
  write_stdin: 'session_id',
};

function getParamPreview(tc) {
  const input = tc.input;
  if (!input || typeof input !== 'object') return '';
  const key = TOOL_KEY_PARAMS[tc.name];
  if (key && input[key] !== undefined) {
    const val = typeof input[key] === 'string' ? input[key] : JSON.stringify(input[key]);
    return `${key}: "${val}"`;
  }
  const keys = Object.keys(input);
  if (keys.length > 0) {
    const val = typeof input[keys[0]] === 'string' ? input[keys[0]] : JSON.stringify(input[keys[0]]);
    return `${keys[0]}: "${val}"`;
  }
  return '';
}

function formatOutput(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    return output.map(b => {
      if (b.type === 'text') return typeof b.text === 'string' ? b.text : JSON.stringify(b.text);
      if (b.type === 'resource') return JSON.stringify(b.resource, null, 2);
      return JSON.stringify(b);
    }).filter(Boolean).join('\n');
  }
  return JSON.stringify(output, null, 2);
}

export default function ToolCallBlock({ toolCalls }) {
  const { settings } = useSettingsContext();
  const { selectSubagent } = useSubagentPanel();
  const showSetting = settings?.showToolCalls || 'fold';

  if (!toolCalls || toolCalls.length === 0 || showSetting === 'hide') return null;

  const [expandedSet, setExpandedSet] = useState(() => {
    if (showSetting === 'unfold') return new Set(toolCalls.map((_, i) => i));
    return new Set();
  });

  function toggleToolCall(index) {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleKeyDown(e, index) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleToolCall(index);
    }
  }

  return (
    <div style={{ margin: '8px 0' }}>
      {toolCalls.map((tc, i) => {
        const expanded = expandedSet.has(i);
        const hasResult = !!tc.result;
        const preview = getParamPreview(tc);
        const summary = preview ? `${tc.name}(${preview})` : tc.name;

        const isSubagent = (tc.name === 'Agent' || tc.name === 'spawn_agent') && tc.subagent;

        return (
          <div key={tc.name + '-' + i} style={{ marginTop: i > 0 ? '4px' : 0 }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleToolCall(i)}
              onKeyDown={e => handleKeyDown(e, i)}
              aria-expanded={expanded}
              style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', userSelect: 'none', display: 'flex', alignItems: 'center', padding: '2px 0' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {expanded ? '▼' : '▶'} {summary}
                {hasResult && !expanded && ' ✓'}
              </span>
              {isSubagent && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); selectSubagent(tc.subagent, tc.subagentFilePath); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSubagent(tc.subagent, tc.subagentFilePath); } }}
                  style={{
                    cursor: 'pointer', fontSize: '11px', color: 'var(--accent-color)',
                    whiteSpace: 'nowrap', marginLeft: '8px'
                  }}
                >
                  查看子 agent 过程
                </span>
              )}
            </div>
            {expanded && (
              <div style={{
                marginTop: '4px', padding: '8px', borderRadius: '4px',
                background: 'var(--bg-secondary)', fontSize: '12px',
                fontFamily: 'var(--font-mono)'
              }}>
                <div style={{ color: 'var(--accent-color)', marginBottom: '4px' }}>
                  → {tc.name}
                </div>
                {tc.input && <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                  {JSON.stringify(tc.input, null, 2)}
                </pre>}
                {tc.result && (
                  <div style={{ marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                    <div style={{ color: 'var(--text-success, #22c55e)', marginBottom: '2px', fontSize: '11px' }}>← 返回结果:</div>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-secondary)', maxHeight: '200px', overflow: 'auto' }}>
                      {formatOutput(tc.result)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
