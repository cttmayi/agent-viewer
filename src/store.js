/**
 * 内存会话存储
 * 以文件路径为 key 存储解析后的会话数据
 * 同时维护按目录结构的树形索引
 */

import path from 'path';

const sessions = new Map();
const sidechains = new Map(); // sessionId → Message[][] (array of groups, one per subagent file)

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
    clear: () => { sessions.clear(); sidechains.clear(); },
    addSidechainGroup,
    getSidechainGroups
  };
}

function addSidechainGroup(sessionId, messages) {
  if (!sidechains.has(sessionId)) {
    sidechains.set(sessionId, []);
  }
  sidechains.get(sessionId).push(messages);
}

function getSidechainGroups(sessionId) {
  return sidechains.get(sessionId) || [];
}

function getAll() {
  return Array.from(sessions.values()).map(e => e.session);
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
