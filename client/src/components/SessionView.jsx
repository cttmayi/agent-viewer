import React, { useState, useEffect } from 'react';
import StatsHeader from './StatsHeader.jsx';
import MessageList from './MessageList.jsx';
import { useSubagentPanel } from '../hooks/SubagentPanelContext.jsx';

function SubagentDetailPanel() {
  const { subagent, clearSubagent } = useSubagentPanel();

  if (!subagent) return null;

  return (
    <div style={{
      width: '45%', minWidth: '400px',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-primary)'
    }}>
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '13px'
      }}>
        <button
          type="button"
          onClick={clearSubagent}
          style={{ color: 'var(--accent-color)', cursor: 'pointer', fontSize: '13px' }}
        >
          ← 返回
        </button>
        <span style={{ color: 'var(--text-muted)' }}>子 agent 对话 ({subagent.length} 条消息)</span>
      </div>
      <MessageList messages={subagent} />
    </div>
  );
}

export default function SessionView({ session, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fileId = session?.session?.filePath
    ? btoa(unescape(encodeURIComponent(session.session.filePath)))
    : '';

  useEffect(() => {
    if (!fileId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/sessions/${fileId}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
      .then(d => { if (!controller.signal.aborted) { setData(d); setLoading(false); } })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message || '加载失败'); setLoading(false); } });
    return () => controller.abort();
  }, [fileId]);

  if (loading) return <div role="status" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>;
  if (error) return <div role="alert" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red' }}>{error}</div>;
  if (!data) return null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* 主对话 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <button type="button" onClick={onBack} style={{ color: 'var(--accent-color)', fontSize: '13px' }}>
            ← 返回列表
          </button>
        </div>
        <StatsHeader session={data.session} stats={data.stats} />
        <MessageList messages={data.messages} />
      </div>
      {/* 子 agent 详情面板 */}
      <SubagentDetailPanel />
    </div>
  );
}
