import React, { useState, useRef } from 'react';

export default function DragDropOverlay() {
  const [dragging, setDragging] = useState(false);
  const dragCount = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCount.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCount.current--;
    if (dragCount.current === 0) setDragging(false);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    dragCount.current = 0;

    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jsonl'));
    if (files.length === 0) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      await fetch('/api/upload', { method: 'POST', body: formData });
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, pointerEvents: 'none' }}
    >
      {dragging && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(74, 144, 217, 0.1)',
          border: '3px dashed var(--accent-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', color: 'var(--accent-color)',
          pointerEvents: 'auto'
        }}>
          拖放 .jsonl 文件以导入会话
        </div>
      )}
    </div>
  );
}
