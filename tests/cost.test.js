import { describe, it, expect } from 'vitest';
import { calcMessageCost, calcSessionCost } from '../src/cost.js';

describe('calcMessageCost', () => {
  const samplePrices = {
    'claude-sonnet-4-20250514': {
      currency: 'USD',
      input: 3.0,
      output: 15.0,
      cacheWrite: 3.75,
      cacheRead: 0.30,
    },
    'deepseek-chat': {
      currency: 'CNY',
      input: 2.0,
      output: 8.0,
      cacheWrite: 2.0,
      cacheRead: 0.50,
    },
  };

  it('returns null for unknown model', () => {
    const result = calcMessageCost(
      { input: 1000, output: 500, cacheCreate: 0, cacheRead: 0 },
      'unknown-model',
      samplePrices,
    );
    expect(result).toBeNull();
  });

  it('computes USD cost correctly', () => {
    const tokenUsage = { input: 10000, output: 5000, cacheCreate: 2000, cacheRead: 3000 };
    const result = calcMessageCost(tokenUsage, 'claude-sonnet-4-20250514', samplePrices);

    expect(result).not.toBeNull();
    expect(result.currency).toBe('USD');
    expect(result.input).toBeCloseTo(0.03, 6);
    expect(result.output).toBeCloseTo(0.075, 6);
    expect(result.cacheWrite).toBeCloseTo(0.0075, 6);
    expect(result.cacheRead).toBeCloseTo(0.0009, 6);
    expect(result.total).toBeCloseTo(0.1134, 6);
  });

  it('computes CNY cost with cache read', () => {
    const tokenUsage = { input: 20000, output: 10000, cacheCreate: 0, cacheRead: 5000 };
    const result = calcMessageCost(tokenUsage, 'deepseek-chat', samplePrices);

    expect(result).not.toBeNull();
    expect(result.currency).toBe('CNY');
    expect(result.input).toBeCloseTo(0.04, 6);
    expect(result.output).toBeCloseTo(0.08, 6);
    expect(result.cacheWrite).toBeCloseTo(0, 6);
    expect(result.cacheRead).toBeCloseTo(0.0025, 6);
    expect(result.total).toBeCloseTo(0.1225, 6);
  });

  it('handles empty usage', () => {
    const result = calcMessageCost({}, 'claude-sonnet-4-20250514', samplePrices);

    expect(result).not.toBeNull();
    expect(result.currency).toBe('USD');
    expect(result.input).toBe(0);
    expect(result.output).toBe(0);
    expect(result.cacheWrite).toBe(0);
    expect(result.cacheRead).toBe(0);
    expect(result.total).toBe(0);
  });

  it('returns null when modelPrices is empty', () => {
    const result = calcMessageCost(
      { input: 1000, output: 500, cacheCreate: 0, cacheRead: 0 },
      'claude-sonnet-4-20250514',
      {},
    );
    expect(result).toBeNull();
  });

  it('returns null when modelPrices is undefined', () => {
    const result = calcMessageCost(
      { input: 1000, output: 500, cacheCreate: 0, cacheRead: 0 },
      'claude-sonnet-4-20250514',
      undefined,
    );
    expect(result).toBeNull();
  });
});

describe('calcSessionCost', () => {
  const samplePrices = {
    'claude-sonnet-4-20250514': {
      currency: 'USD',
      input: 3.0,
      output: 15.0,
      cacheWrite: 3.75,
      cacheRead: 0.30,
    },
    'deepseek-chat': {
      currency: 'CNY',
      input: 2.0,
      output: 8.0,
      cacheWrite: 2.0,
      cacheRead: 0.50,
    },
  };

  it('aggregates costs by currency across multiple messages', () => {
    const messages = [
      { role: 'user', model: 'claude-sonnet-4-20250514', tokenUsage: { input: 10000, output: 0, cacheCreate: 0, cacheRead: 0 } },
      { role: 'assistant', model: 'claude-sonnet-4-20250514', tokenUsage: { input: 0, output: 5000, cacheCreate: 0, cacheRead: 0 } },
      { role: 'user', model: 'deepseek-chat', tokenUsage: { input: 20000, output: 0, cacheCreate: 0, cacheRead: 0 } },
      { role: 'assistant', model: 'deepseek-chat', tokenUsage: { input: 0, output: 10000, cacheCreate: 0, cacheRead: 0 } },
    ];

    const result = calcSessionCost(messages, samplePrices);

    // Non-assistant messages get null
    expect(result.messageCosts[0]).toBeNull();
    expect(result.messageCosts[2]).toBeNull();

    // Assistant 1 (USD): 0 + 5000/1000000*15 = 0.075
    expect(result.messageCosts[1]).not.toBeNull();
    expect(result.messageCosts[1].total).toBeCloseTo(0.075, 6);
    expect(result.messageCosts[1].currency).toBe('USD');

    // Assistant 2 (CNY): 0 + 10000/1000000*8 = 0.08
    expect(result.messageCosts[3]).not.toBeNull();
    expect(result.messageCosts[3].total).toBeCloseTo(0.08, 6);
    expect(result.messageCosts[3].currency).toBe('CNY');

    // Total by currency
    expect(result.totalByCurrency.USD).toBeCloseTo(0.075, 6);
    expect(result.totalByCurrency.CNY).toBeCloseTo(0.08, 6);
  });

  it('returns empty totals for no messages', () => {
    const result = calcSessionCost([], samplePrices);
    expect(result.messageCosts).toEqual([]);
    expect(result.totalByCurrency).toEqual({});
  });
});
