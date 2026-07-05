import React, { useState, useRef, useLayoutEffect } from 'react';
import ThinkingBlock from './ThinkingBlock.jsx';
import ToolCallBlock from './ToolCallBlock.jsx';
import MarkdownContent from './MarkdownContent.jsx';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';
import { useSubagentPanel } from '../hooks/SubagentPanelContext.jsx';

function formatTokenBreakdown(msg) {
  const parts = [];
  if (msg.tokenUsage?.input) parts.push(`↑${msg.tokenUsage.input}`);
  if (msg.tokenUsage?.output) parts.push(`↓${msg.tokenUsage.output}`);
  if (msg.tokenUsage?.cacheRead) parts.push(`⊙${msg.tokenUsage.cacheRead}`);
  if (msg.tokenUsage?.cacheCreate) parts.push(`◎${msg.tokenUsage.cacheCreate}`);
  return parts.join(' ');
}

function formatMsgCost(cost) {
  if (!cost || cost.total <= 0) return '';
  const symbol = cost.currency === 'CNY' ? '¥' : '$';
  if (cost.total < 0.0001) return '<' + symbol + '0.0001';
  return symbol + cost.total.toFixed(4);
}

export default function AssistantMessage({ message }) {
  const { settings } = useSettingsContext();
  const { selectSubagent } = useSubagentPanel();
  const maxLines = settings?.messageMaxLines || 0;
  const markdownEnabled = settings?.markdownEnabled !== false;
  const showHeader = settings?.showMessageHeader !== false;
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef(null);

  const content = Array.isArray(message.content) ? message.content
    : [{ type: 'text', text: String(message.content ?? '') }];
  const textParts = content.filter(c => c.type === 'text' || c.type === undefined);
  let text = textParts.map(c => (typeof c.text === 'string' ? c.text : JSON.stringify(c.text))).filter(Boolean).join('\n') || '';
  const thinkingText = content.filter(c => c.type === 'thinking').map(c => {
    const t = c.thinking || c.text;
    return typeof t === 'string' ? t : JSON.stringify(t);
  }).join('\n');
  const time = message.timestamp ? new Date(message.timestamp).toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  const duration = message.duration ? `${(message.duration / 1000).toFixed(1)}s` : '';
  const tokenBreakdown = formatTokenBreakdown(message);
  const msgCost = formatMsgCost(message.cost);

  // Compute subagent total cost from sidechainMessages and toolCall subagent messages
  let subagentTotal = 0;
  let subagentCurrency = null;
  for (const sc of message.sidechainMessages || []) {
    if (sc.cost?.total > 0) { subagentTotal += sc.cost.total; subagentCurrency = sc.cost.currency; }
  }
  for (const tc of (message.toolCalls || [])) {
    if (tc.subagent) {
      for (const sc of tc.subagent) {
        if (sc.cost?.total > 0) { subagentTotal += sc.cost.total; subagentCurrency = sc.cost.currency; }
      }
    }
  }
  const subagentCostStr = subagentTotal > 0 ? formatMsgCost({ total: subagentTotal, currency: subagentCurrency }) : '';

  const hasSubagent = message.toolCalls?.some(tc => tc.name === 'Agent' && tc.subagent);
  const subagentLink = hasSubagent ? (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); selectSubagent(message.toolCalls.find(tc => tc.name === 'Agent' && tc.subagent).subagent); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSubagent(message.toolCalls.find(tc => tc.name === 'Agent' && tc.subagent).subagent); } }}
      style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--accent-color)', whiteSpace: 'nowrap' }}
    >
      查看子 agent →
    </span>
  ) : null;

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && maxLines > 0) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text, maxLines, expanded, markdownEnabled]);

  const collapsedStyle = markdownEnabled
    ? { maxHeight: `${maxLines * 1.6}em`, overflow: 'hidden' }
    : { display: '-webkit-box', WebkitLineClamp: maxLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' };

  const showButton = maxLines > 0 && text && (overflows || expanded);

  const textEl = markdownEnabled
    ? <MarkdownContent text={text} />
    : text;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        background: 'var(--assistant-msg-bg)', borderRadius: '8px',
        padding: '10px 14px',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontSize: '14px', lineHeight: '1.5',
        position: 'relative'
      }}>
        {showHeader && (
          <div style={{ fontSize: '11px', marginBottom: '6px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              <span style={{ color: 'var(--accent-color)' }}>AI</span>
              {message.model && <span style={{ color: '#4fc3f7' }}> · {message.model}</span>}
              <span style={{ color: 'var(--text-secondary)' }}> · {[time, duration].filter(Boolean).join(' · ')}</span>
              {tokenBreakdown && <span style={{ color: '#34d399' }}> · {tokenBreakdown}</span>}
              {msgCost && <span style={{ color: '#e6a817' }}> · {msgCost}</span>}
              {subagentCostStr && <span style={{ color: '#e6a817', opacity: 0.65 }}> · 子Agent:{subagentCostStr}</span>}
            </span>
            {subagentLink}
          </div>
        )}
        <ThinkingBlock thinking={thinkingText} />
        {text && <div ref={textRef} style={maxLines > 0 && !expanded ? collapsedStyle : {}}>{textEl}</div>}
        {showButton && (
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none',
              textAlign: 'right', marginTop: '4px'
            }}
          >
            {expanded ? '收起' : '展开全部'}
          </div>
        )}
        <ToolCallBlock toolCalls={message.toolCalls} />
      </div>
    </div>
  );
}
