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

function highlightChildren(children, regex) {
  if (!regex) return children;
  return React.Children.map(children, child => {
    if (typeof child === 'string') {
      const parts = child.split(regex);
      if (parts.length === 1) return child;
      return parts.map((part, i) =>
        i % 2 === 1 ? React.createElement('mark', { key: i }, part) : part
      );
    }
    return child;
  });
}

export function HighlightedText({ text, query }) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return React.createElement(React.Fragment, null,
    parts.map((part, i) =>
      i % 2 === 1 ? React.createElement('mark', { key: i }, part) : part
    )
  );
}

export default function MarkdownContent({ text, highlight }) {
  if (!text) return null;

  const highlightRE = highlight
    ? new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    : null;

  const hc = (children) => highlightChildren(children, highlightRE);

  return (
    <div style={{ whiteSpace: 'normal' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p({ children }) {
          return <p style={P_MARGIN}>{hc(children)}</p>;
        },
        ul({ children }) {
          return <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ul>;
        },
        ol({ children }) {
          return <ol style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ol>;
        },
        li({ children }) {
          return <li style={{ margin: '3px 0' }}>{hc(children)}</li>;
        },
        h1({ children }) {
          return <h1 style={{ margin: '8px 0 4px', fontSize: '16px' }}>{hc(children)}</h1>;
        },
        h2({ children }) {
          return <h2 style={{ margin: '6px 0 3px', fontSize: '15px' }}>{hc(children)}</h2>;
        },
        h3({ children }) {
          return <h3 style={{ margin: '6px 0 3px', fontSize: '14px' }}>{hc(children)}</h3>;
        },
        blockquote({ children }) {
          return <blockquote style={{ margin: '4px 0', paddingLeft: '10px', borderLeft: '3px solid var(--border-color)', color: 'var(--text-secondary)' }}>{hc(children)}</blockquote>;
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
          return <th style={{ border: '1px solid var(--border-color)', padding: '6px 10px', background: 'var(--bg-tertiary)' }}>{hc(children)}</th>;
        },
        td({ children }) {
          return <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px' }}>{hc(children)}</td>;
        },
      }}
    >
      {text}
    </ReactMarkdown>
    </div>
  );
}
