import React, { useState, useRef } from 'react';

function getFilesRecursively(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      if (entry.name.endsWith('.jsonl')) {
        entry.file(resolve);
      } else {
        resolve(null);
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const allEntries = [];
      function readBatch() {
        reader.readEntries((entries) => {
          if (entries.length === 0) {
            Promise.all(allEntries).then((files) => resolve(files.filter(Boolean)));
          } else {
            allEntries.push(...entries.map(getFilesRecursively));
            readBatch();
          }
        });
      }
      readBatch();
    } else {
      resolve(null);
    }
  });
}

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

    const promises = [];
    for (const item of e.dataTransfer.items) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        promises.push(getFilesRecursively(entry));
      }
    }
    const results = await Promise.all(promises);
    const files = results.flat().filter(Boolean);
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
          拖放 .jsonl 文件或目录以导入会话
        </div>
      )}
    </div>
  );
}
