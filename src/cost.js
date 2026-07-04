/**
 * Calculate the cost of a single message based on token usage and model prices.
 *
 * @param {Object} tokenUsage - Token usage breakdown
 * @param {number} [tokenUsage.input] - Input tokens
 * @param {number} [tokenUsage.output] - Output tokens
 * @param {number} [tokenUsage.cacheCreate] - Cache creation tokens (uses cacheWrite price)
 * @param {number} [tokenUsage.cacheRead] - Cache read tokens
 * @param {string} modelName - Model identifier
 * @param {Object} modelPrices - Map of model names to price definitions
 * @returns {Object|null} Cost breakdown with input, output, cacheWrite, cacheRead, total, currency or null
 */
export function calcMessageCost(tokenUsage, modelName, modelPrices) {
  if (!modelPrices || !modelPrices[modelName]) {
    return null;
  }

  const prices = modelPrices[modelName];
  const usage = tokenUsage || {};

  const input = ((usage.input || 0) / 1_000_000) * prices.input;
  const output = ((usage.output || 0) / 1_000_000) * prices.output;
  const cacheWrite = ((usage.cacheCreate || 0) / 1_000_000) * prices.cacheWrite;
  const cacheRead = ((usage.cacheRead || 0) / 1_000_000) * prices.cacheRead;
  const total = input + output + cacheWrite + cacheRead;

  return {
    input,
    output,
    cacheWrite,
    cacheRead,
    total,
    currency: prices.currency,
  };
}

/**
 * Calculate costs for all messages in a session.
 *
 * @param {Array} messages - Array of message objects with role, model, tokenUsage
 * @param {Object} modelPrices - Map of model names to price definitions
 * @returns {{ messageCosts: Array, totalByCurrency: Object }}
 */
export function calcSessionCost(messages, modelPrices) {
  const messageCosts = messages.map((msg) => {
    if (msg.role !== 'assistant') {
      return null;
    }
    return calcMessageCost(msg.tokenUsage, msg.model, modelPrices);
  });

  const totalByCurrency = {};
  for (const cost of messageCosts) {
    if (cost && cost.currency) {
      totalByCurrency[cost.currency] = (totalByCurrency[cost.currency] || 0) + cost.total;
    }
  }

  return { messageCosts, totalByCurrency };
}
