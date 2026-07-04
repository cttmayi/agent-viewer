import React from 'react';

export default function SearchBar({ value, onChange }) {
  return (
    <div style={{ padding: '8px' }}>
      <input
        type="text"
        placeholder="搜索会话..."
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '6px 10px', borderRadius: '6px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-primary)', fontSize: '13px',
          outline: 'none'
        }}
      />
    </div>
  );
}
