import React from 'react';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';

const LABELS = {
  messageMaxLines: '消息默认行数',
  showThinking: 'Thinking 内容',
  showToolCalls: '工具调用详情',
  showSidechains: '子 Agent 侧链',
  theme: '主题'
};

const OPTIONS = {
  messageMaxLines: [
    { value: 0, label: '全部' },
    { value: 3, label: '3行' },
    { value: 5, label: '5行' },
    { value: 10, label: '10行' },
    { value: 15, label: '15行' }
  ],
  showThinking: [
    { value: 'fold', label: '折叠' },
    { value: 'unfold', label: '展开' },
    { value: 'hide', label: '不显示' }
  ],
  showToolCalls: [
    { value: 'fold', label: '折叠' },
    { value: 'unfold', label: '展开' },
    { value: 'hide', label: '不显示' }
  ],
  showSidechains: [
    { value: 'fold', label: '折叠' },
    { value: 'unfold', label: '展开' },
    { value: 'hide', label: '不显示' }
  ],
  theme: [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' }
  ]
};

export default function SettingsPanel({ onClose }) {
  const { settings, loading, update } = useSettingsContext();

  if (loading || !settings) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.3)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-primary)', borderRadius: '12px',
          padding: '24px', width: '400px'
        }}>
          <div style={{ padding: '16px', textAlign: 'center' }}>加载中...</div>
        </div>
      </div>
    );
  }

  const handleChange = (key, value) => {
    update({ [key]: value });
  };

  const renderField = (key) => {
    const opts = OPTIONS[key];
    if (!opts) return null;
    return (
      <div key={key} style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
          {LABELS[key]}
        </label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {opts.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleChange(key, opt.value)}
              style={{
                padding: '4px 12px', borderRadius: '4px', fontSize: '13px',
                background: settings[key] === opt.value ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                color: settings[key] === opt.value ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-primary)', borderRadius: '12px',
        padding: '24px', width: '400px', maxHeight: '80vh', overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px' }}>设置</h2>
          <button onClick={onClose} style={{ fontSize: '18px' }}>✕</button>
        </div>
        {Object.keys(LABELS).map(renderField)}
      </div>
    </div>
  );
}
