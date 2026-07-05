import { Router } from 'express';
import { calcSessionCost, calcMessageCost } from '../cost.js';

const router = Router();

router.get('/directory-tree', (req, res) => {
  const { store, config } = req.app.locals;
  const tree = store.buildDirectoryTree(config.directories);
  res.json(tree);
});

router.get('/search', (req, res) => {
  const { store } = req.app.locals;
  const { q } = req.query;
  if (!q) return res.json([]);
  const results = store.search(q);
  res.json(results);
});

router.get('/:fileId', (req, res) => {
  const { store, config } = req.app.locals;
  const filePath = Buffer.from(req.params.fileId, 'base64').toString('utf-8');
  const data = store.get(filePath);
  if (!data) return res.status(404).json({ error: '会话未找到' });

  data.session.filePath = filePath;

  // Inject cost data
  const costs = calcSessionCost(data.messages || [], config.modelPrices || {});
  data.costs = costs;
  for (let i = 0; i < data.messages.length; i++) {
    data.messages[i].cost = costs.messageCosts[i] || null;
    // Include sidechain message costs in totals only
    for (const sc of data.messages[i].sidechainMessages || []) {
      sc.cost = calcMessageCost(sc.tokenUsage, sc.model, config.modelPrices);
      if (sc.cost && sc.cost.currency) {
        costs.totalByCurrency[sc.cost.currency] = (costs.totalByCurrency[sc.cost.currency] || 0) + sc.cost.total;
      }
    }
  }
  // Also add to stats for StatsHeader access
  data.stats.totalByCurrency = costs.totalByCurrency;

  // Link subagent groups to Agent tool_uses by timestamp ordering
  if (data.session && data.session.id && data.messages) {
    const groups = store.getSidechainGroups(data.session.id);
    if (groups.length > 0) {
      // Collect all Agent tool_uses with msg timestamp
      const agentCalls = [];
      for (const msg of data.messages) {
        if (msg.role === 'assistant' && msg.toolCalls?.length) {
          for (const tc of msg.toolCalls) {
            if (tc.name === 'Agent' && tc.type === 'tool_use') {
              agentCalls.push({ tc, timestamp: msg.timestamp });
            }
          }
        }
      }

      // Sort both by timestamp and match 1:1
      agentCalls.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const sortedGroups = [...groups].sort((a, b) => {
        const ta = a[0]?.timestamp || '';
        const tb = b[0]?.timestamp || '';
        return new Date(ta) - new Date(tb);
      });

      const count = Math.min(agentCalls.length, sortedGroups.length);
      for (let i = 0; i < count; i++) {
        agentCalls[i].tc.subagent = sortedGroups[i];
      }
    }
  }

  // Compute costs for toolCall subagent messages
  for (const msg of data.messages) {
    if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (tc.subagent) {
          for (const sc of tc.subagent) {
            sc.cost = calcMessageCost(sc.tokenUsage, sc.model, config.modelPrices);
            if (sc.cost && sc.cost.currency) {
              costs.totalByCurrency[sc.cost.currency] = (costs.totalByCurrency[sc.cost.currency] || 0) + sc.cost.total;
            }
          }
        }
      }
    }
  }

  res.json(data);
});

export default router;
