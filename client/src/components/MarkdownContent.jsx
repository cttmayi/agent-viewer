import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CODE_STYLE = {
  background: 'var(--bg-tertiary)',
  borderRadius: '3px',
  padding: '2px 6px',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
};

const PRE_STYLE = {
  background: 'var(--bg-tertiary)',
  borderRadius: '6px',
  padding: '12px',
  overflow: 'auto',
  fontSize: '13px',
  lineHeight: '1.4',
  margin: '8px 0',
};

const LINK_STYLE = {
  color: 'var(--accent-color)',
  textDecoration: 'underline',
};

export default function MarkdownContent({ text }) {
  if (!text) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !className;
          if (isInline) {
            return <code style={CODE_STYLE} {...props}>{children}</code>;
          }
          return (
            <pre style={PRE_STYLE}>
              <code className={className} {...props}>{children}</code>
            </pre>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>{children}</a>;
        },
        table({ children }) {
          return <div style={{ overflow: 'auto', margin: '8px 0' }}><table style={{ borderCollapse: 'collapse', fontSize: '13px' }}>{children}</table></div>;
        },
        th({ children }) {
          return <th style={{ border: '1px solid var(--border-color)', padding: '6px 10px', background: 'var(--bg-tertiary)' }}>{children}</th>;
        },
        td({ children }) {
          return <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px' }}>{children}</td>;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
