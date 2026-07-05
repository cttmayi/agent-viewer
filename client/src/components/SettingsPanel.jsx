import React, { useState, useEffect } from 'react';
import { useSettingsContext } from '../hooks/SettingsContext.jsx';

const LABELS = {
  messageMaxLines: '消息默认行数',
  showThinking: 'Thinking 内容',
  showToolCalls: '工具调用详情',
  showSidechains: '子 Agent 侧链',
  markdownEnabled: 'Markdown 渲染',
  showMessageHeader: '消息头部',
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
  ],
  markdownEnabled: [
    { value: true, label: '开' },
    { value: false, label: '关' }
  ],
  showMessageHeader: [
    { value: true, label: '显示' },
    { value: false, label: '隐藏' }
  ]
};

export default function SettingsPanel({ onClose }) {
  const { settings, modelPrices, loading, update, updateModelPrices } = useSettingsContext();
  const [pricesText, setPricesText] = useState('');
  const [parseError, setParseError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (modelPrices) {
      setPricesText(JSON.stringify(modelPrices, null, 2));
    }
  }, [modelPrices]);

  const handleSavePrices = () => {
    try {
      const parsed = JSON.parse(pricesText);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('需要 JSON 对象');
      for (const [name, model] of Object.entries(parsed)) {
        if (!model.currency || model.input == null || model.output == null) {
          throw new Error(`"${name}" 缺少 currency、input 或 output`);
        }
      }
      setParseError('');
      setSaveStatus('保存中...');
      updateModelPrices(parsed).then(() => setSaveStatus('已保存')).catch(() => setSaveStatus('保存失败'));
    } catch (e) {
      setParseError('JSON 格式错误: ' + e.message);
    }
  };

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
        {/* ---- Model Prices Editor ---- */}
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
            模型价格 (每百万 Token)
          </label>
          <textarea
            value={pricesText}
            onChange={e => setPricesText(e.target.value)}
            style={{
              width: '100%', minHeight: '150px', padding: '8px',
              fontSize: '12px', fontFamily: 'var(--font-mono)',
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-color)', borderRadius: '4px',
              outline: 'none', resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
            <button onClick={handleSavePrices} style={{
              padding: '4px 12px', borderRadius: '4px', fontSize: '13px',
              background: 'var(--accent-color)', color: '#fff', border: 'none',
              cursor: 'pointer'
            }}>
              保存价格
            </button>
            {saveStatus && <span style={{ color: 'var(--text-success)', fontSize: '12px' }}>{saveStatus}</span>}
          </div>
          {parseError && <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>{parseError}</div>}
        </div>
      </div>
    </div>
  );
}
