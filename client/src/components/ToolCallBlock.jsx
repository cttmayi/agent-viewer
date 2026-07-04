import React, { useState } from 'react';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';
import { useSubagentPanel } from '../hooks/SubagentPanelContext.jsx';

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

  const [expanded, setExpanded] = useState(showSetting === 'unfold');

  const toolSummary = toolCalls.reduce((acc, tc) => {
    const name = tc.name || 'unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(!expanded);
    }
  }

  const hasResult = toolCalls.some(tc => tc.result);
  const hasSubagent = toolCalls.some(tc => tc.name === 'Agent' && tc.subagent);

  return (
    <div style={{ margin: '8px 0' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-controls="tool-calls-content"
        style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>{expanded ? '▼' : '▶'} 工具调用: {Object.entries(toolSummary).map(([k, v]) => `${k}(${v})`).join(', ')}
        {hasResult && !expanded && ' ✓'}</span>
        {hasSubagent && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); selectSubagent(toolCalls.find(tc => tc.name === 'Agent' && tc.subagent)?.subagent); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSubagent(toolCalls.find(tc => tc.name === 'Agent' && tc.subagent)?.subagent); } }}
            style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--accent-color)', whiteSpace: 'nowrap' }}
          >
            查看子 agent 过程 →
          </span>
        )}
      </div>
      <div id="tool-calls-content">
        {expanded && toolCalls.map((tc, i) => (
          <div key={tc.name + '-' + i} style={{
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
            {tc.name === 'Agent' && tc.subagent && (
              <div style={{ marginTop: '6px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); selectSubagent(tc.subagent); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSubagent(tc.subagent); } }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    cursor: 'pointer', fontSize: '12px', color: 'var(--accent-color)',
                    padding: '3px 8px', borderRadius: '4px',
                    background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                    userSelect: 'none'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3zm2 0v8h6V3H5zm2 10H4v1.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V13H7z"/>
                  </svg>
                  查看子 agent 过程
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
