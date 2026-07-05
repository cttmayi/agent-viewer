import React, { useState, useEffect, useMemo } from 'react';
import StatsHeader from './StatsHeader.jsx';
import MessageList from './MessageList.jsx';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';
import { useSubagentPanel } from '../hooks/SubagentPanelContext.jsx';
import { calcMessageCost, calcSessionCost } from '../utils/cost.js';

function SubagentDetailPanel() {
  const { subagent, clearSubagent } = useSubagentPanel();
  const { modelPrices } = useSettingsContext();

  if (!subagent) return null;

  // Compute stats from subagent messages
  let totalInput = 0, totalOutput = 0, totalCacheCreate = 0, totalCacheRead = 0;
  let toolCallCount = 0;
  const toolCount = {};
  const totalByCurrency = {};

  for (const msg of subagent) {
    if (msg.tokenUsage) {
      totalInput += msg.tokenUsage.input || 0;
      totalOutput += msg.tokenUsage.output || 0;
      totalCacheCreate += msg.tokenUsage.cacheCreate || 0;
      totalCacheRead += msg.tokenUsage.cacheRead || 0;
    }
    if (msg.toolCalls) {
      toolCallCount += msg.toolCalls.length;
      for (const tc of msg.toolCalls) {
        toolCount[tc.name] = (toolCount[tc.name] || 0) + 1;
      }
    }
    if (!msg.cost) {
      msg.cost = calcMessageCost(msg.tokenUsage, msg.model, modelPrices);
    }
    if (msg.cost?.currency) {
      totalByCurrency[msg.cost.currency] = (totalByCurrency[msg.cost.currency] || 0) + msg.cost.total;
    }
  }

  const topTools = Object.entries(toolCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const stats = {
    totalTurns: Math.ceil(subagent.length / 2),
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCacheCreateTokens: totalCacheCreate,
    totalCacheReadTokens: totalCacheRead,
    totalDuration: 0,
    toolCallCount,
    topUsedTools: topTools,
    totalByCurrency,
  };

  const subagentSession = {
    title: '子 Agent 对话',
    agentType: '',
    model: '',
    messageCount: subagent.length,
  };

  return (
    <div style={{
      width: '45%', minWidth: '400px',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-primary)'
    }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <button type="button" onClick={clearSubagent} style={{ color: 'var(--accent-color)', fontSize: '13px' }}>
          ← 返回
        </button>
      </div>
      <StatsHeader session={subagentSession} stats={stats} />
      <MessageList messages={subagent} />
    </div>
  );
}

export default function SessionView({ session, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { modelPrices } = useSettingsContext();

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

  // Recalculate costs when modelPrices change (live update without refresh)
  const liveData = useMemo(() => {
    if (!data) return null;
    const costs = calcSessionCost(data.messages || [], modelPrices);
    // Include sidechain/subagent message costs in totals only
    for (let i = 0; i < (data.messages || []).length; i++) {
      for (const sc of data.messages[i].sidechainMessages || []) {
        sc.cost = calcMessageCost(sc.tokenUsage, sc.model, modelPrices);
        if (sc.cost && sc.cost.currency) {
          costs.totalByCurrency[sc.cost.currency] = (costs.totalByCurrency[sc.cost.currency] || 0) + sc.cost.total;
        }
      }
    }
    // Include toolCall subagent costs in totals only
    for (const msg of data.messages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          if (tc.subagent) {
            for (const sc of tc.subagent) {
              sc.cost = calcMessageCost(sc.tokenUsage, sc.model, modelPrices);
              if (sc.cost && sc.cost.currency) {
                costs.totalByCurrency[sc.cost.currency] = (costs.totalByCurrency[sc.cost.currency] || 0) + sc.cost.total;
              }
            }
          }
        }
      }
    }
    return {
      ...data,
      costs,
      messages: data.messages.map((msg, i) => ({ ...msg, cost: costs.messageCosts[i] || null })),
      stats: { ...data.stats, totalByCurrency: costs.totalByCurrency },
    };
  }, [data, modelPrices]);

  if (loading) return <div role="status" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>;
  if (error) return <div role="alert" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red' }}>{error}</div>;
  if (!liveData) return null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* 主对话 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <StatsHeader session={liveData.session} stats={liveData.stats} />
        <MessageList messages={liveData.messages} />
      </div>
      {/* 子 agent 详情面板 */}
      <SubagentDetailPanel />
    </div>
  );
}
