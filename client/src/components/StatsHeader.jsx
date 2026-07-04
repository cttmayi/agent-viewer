import React from 'react';

function fmtDuration(ms) {
  if (!ms) return '-';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m${s % 60}s` : `${s}s`;
}

function fmtTokens(n) {
  if (!n) return '-';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export default function StatsHeader({ session, stats }) {
  if (!session || !stats) return null;
  return (
    <div style={{
      padding: '12px 16px', background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)', fontSize: '13px'
    }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
        {session.title}
        <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          {session.agentType} · {session.model || '未知模型'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
        <span>消息: {session.messageCount}</span>
        <span>输入: {fmtTokens(stats.totalInputTokens)}</span>
        <span>输出: {fmtTokens(stats.totalOutputTokens)}</span>
        {stats.totalCacheCreateTokens > 0 && <span>缓存写入: {fmtTokens(stats.totalCacheCreateTokens)}</span>}
        {stats.totalCacheReadTokens > 0 && <span>缓存读取: {fmtTokens(stats.totalCacheReadTokens)}</span>}
        <span>耗时: {fmtDuration(stats.totalDuration)}</span>
        <span>工具调用: {stats.toolCallCount}次</span>
        {stats.topUsedTools?.length > 0 && (
          <span>常用工具: {stats.topUsedTools.slice(0, 5).map(t => t.name).join(', ')}</span>
        )}
      </div>
    </div>
  );
}
