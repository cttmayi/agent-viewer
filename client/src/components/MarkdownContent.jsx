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

const P_MARGIN = { margin: 0 };

export default function MarkdownContent({ text }) {
  if (!text) return null;

  return (
    <div style={{ whiteSpace: 'normal' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p({ children }) {
          return <p style={P_MARGIN}>{children}</p>;
        },
        ul({ children }) {
          return <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ul>;
        },
        ol({ children }) {
          return <ol style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ol>;
        },
        li({ children }) {
          return <li style={{ margin: '3px 0' }}>{children}</li>;
        },
        h1({ children }) {
          return <h1 style={{ margin: '8px 0 4px', fontSize: '16px' }}>{children}</h1>;
        },
        h2({ children }) {
          return <h2 style={{ margin: '6px 0 3px', fontSize: '15px' }}>{children}</h2>;
        },
        h3({ children }) {
          return <h3 style={{ margin: '6px 0 3px', fontSize: '14px' }}>{children}</h3>;
        },
        blockquote({ children }) {
          return <blockquote style={{ margin: '4px 0', paddingLeft: '10px', borderLeft: '3px solid var(--border-color)', color: 'var(--text-secondary)' }}>{children}</blockquote>;
        },
        hr() {
          return <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />;
        },
        code({ className, children, ...props }) {
          const isInline = !/language-\w+/.exec(className || '') && !className;
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
    </div>
  );
}
