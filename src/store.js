/**
 * 内存会话存储
 * 以文件路径为 key 存储解析后的会话数据
 * 同时维护按目录结构的树形索引
 */

import path from 'path';

const sessions = new Map();
const sidechains = new Map(); // sessionId → Message[][] (array of groups, one per subagent file)
const codexSubagentLinks = new Map(); // agentThreadId → { parentSessionId, parentFilePath, taskName }
const linkedCodexChildren = new Set(); // "parentSessionId::childSessionId" — dedup

export function initStore() {
  sessions.clear();
  sidechains.clear();
  return {
    getAll,
    get,
    set,
    remove,
    buildDirectoryTree,
    has,
    search,
    clear: () => { sessions.clear(); sidechains.clear(); codexSubagentLinks.clear(); linkedCodexChildren.clear(); },
    addSidechainGroup,
    getSidechainGroups,
    registerCodexSubagentLink,
    lookupCodexSubagentLink,
    linkCodexSubagents,
    addCodexSidechainGroup
  };
}

function addSidechainGroup(sessionId, messages, filePath = '') {
  if (!sidechains.has(sessionId)) {
    sidechains.set(sessionId, []);
  }
  sidechains.get(sessionId).push({ messages, filePath });
}

function getSidechainGroups(sessionId) {
  return sidechains.get(sessionId) || [];
}

function registerCodexSubagentLink(agentThreadId, parentSessionId, parentFilePath, taskName) {
  codexSubagentLinks.set(agentThreadId, { parentSessionId, parentFilePath, taskName });
}

function lookupCodexSubagentLink(agentThreadId) {
  return codexSubagentLinks.get(agentThreadId) || null;
}

function addCodexSidechainGroup(parentSessionId, childSessionId, messages, filePath = '') {
  const key = `${parentSessionId}::${childSessionId}`;
  if (linkedCodexChildren.has(key)) return;
  linkedCodexChildren.add(key);
  addSidechainGroup(parentSessionId, messages, filePath);
}

function linkCodexSubagents() {
  for (const [filePath, entry] of sessions) {
    const sessionId = entry.session?.id;
    if (!sessionId) continue;
    const link = codexSubagentLinks.get(sessionId);
    if (link && entry.messages) {
      const key = `${link.parentSessionId}::${sessionId}`;
      if (linkedCodexChildren.has(key)) continue;
      linkedCodexChildren.add(key);
      addSidechainGroup(link.parentSessionId, entry.messages.map(normalizeContent), filePath);
      sessions.delete(filePath); // remove subagent from main session list
    }
  }
}

function normalizeContent(msg) {
  if (msg.content && !Array.isArray(msg.content)) {
    msg.content = [{ type: 'text', text: String(msg.content) }];
  }
  return msg;
}

function getAll() {
  return Array.from(sessions.values()).map(e => e.session);
}

function search(query) {
  if (!query) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const [filePath, entry] of sessions) {
    if (!entry.messages) continue;
    const matchedIds = [];
    for (let i = 0; i < entry.messages.length; i++) {
      const msg = entry.messages[i];
      if (!msg.content) continue;
      const blocks = Array.isArray(msg.content) ? msg.content : [{ text: String(msg.content) }];
      for (const c of blocks) {
        if (blockContains(c, q)) {
          let targetId = msg.id;
          // tool_result match in a tool_result-only user message → map to preceding assistant
          // because mergeToolMessages merges/skips these; the rendered element will be the assistant
          if (msg.role === 'user' && c.type === 'tool_result') {
            const hasText = blocks.some(b => (b.type === 'text' || b.type === undefined) && b.text);
            if (!hasText) {
              for (let j = i - 1; j >= 0; j--) {
                if (entry.messages[j].role === 'assistant') {
                  targetId = entry.messages[j].id;
                  break;
                }
              }
            }
          }
          matchedIds.push(targetId);
          break;
        }
      }
    }
    if (matchedIds.length > 0) {
      results.push({ filePath, session: entry.session, matchCount: matchedIds.length, messageIds: matchedIds });
    }
  }
  return results;
}

function blockContains(c, query) {
  if (typeof c === 'string') return c.toLowerCase().includes(query);
  if (c.text && typeof c.text === 'string') return c.text.toLowerCase().includes(query);
  if (c.thinking && typeof c.thinking === 'string') return c.thinking.toLowerCase().includes(query);
  if (c.type === 'tool_result' && c.content != null) {
    const text = extractResultContent(c.content);
    return text.toLowerCase().includes(query);
  }
  return false;
}

function getMsgText(msg) {
  if (!msg.content) return '';
  const parts = Array.isArray(msg.content) ? msg.content : [{ text: String(msg.content) }];
  return parts.map(c => {
    if (typeof c === 'string') return c;
    if (c.text && typeof c.text === 'string') return c.text;
    // thinking block: {type: "thinking", thinking: "..."}
    if (c.thinking && typeof c.thinking === 'string') return c.thinking;
    // tool_result block: {type: "tool_result", content: "..."|array}
    if (c.type === 'tool_result' && c.content != null) {
      return extractResultContent(c.content);
    }
    return '';
  }).filter(Boolean).join(' ');
}

function extractResultContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(x => {
      if (typeof x === 'string') return x;
      if (x.text) return x.text;
      return '';
    }).filter(Boolean).join(' ');
  }
  return '';
}

function get(filePath) {
  return sessions.get(filePath) || null;
}

function set(filePath, data) {
  sessions.set(filePath, data);
}

function remove(filePath) {
  sessions.delete(filePath);
}

function has(filePath) {
  return sessions.has(filePath);
}

function buildDirectoryTree(baseDirs) {
  const root = { name: 'root', type: 'directory', children: [] };

  // Group sessions by which base directory they belong to
  const grouped = {}; // baseDir → { node, sessions }
  for (const base of baseDirs) {
    grouped[base] = { node: { name: base, type: 'directory', children: [] }, sessions: [] };
  }

  for (const [filePath, entry] of sessions.entries()) {
    for (const base of baseDirs) {
      if (filePath.toLowerCase().startsWith(base.toLowerCase())) {
        grouped[base].sessions.push({ filePath, entry });
        break;
      }
    }
  }

  // Build tree for each base dir
  for (const [base, group] of Object.entries(grouped)) {
    const baseNode = group.node;
    for (const { filePath, entry } of group.sessions) {
      const relPath = path.relative(base, filePath);
      const parts = relPath.split(path.sep);
      const fileName = parts.pop();

      let current = baseNode;
      for (const part of parts) {
        if (!current.children) current.children = [];
        let child = current.children.find(c => c.name === part && c.type === 'directory');
        if (!child) {
          child = { name: part, type: 'directory', children: [] };
          current.children.push(child);
        }
        current = child;
      }

      if (!current.children) current.children = [];
      current.children.push({
        name: fileName,
        type: 'file',
        session: entry.session
      });
    }
    if (baseNode.children?.length) {
      root.children.push(baseNode);
    }
  }

  function sortTree(node) {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      if (child.type === 'directory') sortTree(child);
    }
  }
  sortTree(root);

  // flatten single-child directory chains
  function flattenSingleChildDirs(node) {
    if (!node.children) return;
    while (node.children.length === 1 && node.children[0].type === 'directory') {
      const child = node.children[0];
      node.children = child.children || [];
    }
    for (const child of node.children) {
      if (child.type === 'directory') flattenSingleChildDirs(child);
    }
  }
  flattenSingleChildDirs(root);

  function cleanEmpty(node) {
    if (node.children && node.children.length === 0) delete node.children;
    if (node.children) {
      for (const c of node.children) cleanEmpty(c);
    }
  }
  cleanEmpty(root);

  return root;
}
