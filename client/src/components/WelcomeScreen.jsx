import React from 'react';

export default function WelcomeScreen() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: '18px'
    }}>
      从左侧选择一个会话查看
    </div>
  );
}
