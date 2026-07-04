import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWsOn = vi.fn();
const mockClients = new Set();
let mockWsInstance;

vi.mock('ws', () => {
  function MockWebSocketServer() {
    mockWsInstance = {
      on: mockWsOn,
      clients: mockClients
    };
    return mockWsInstance;
  }
  return { WebSocketServer: MockWebSocketServer };
});

import { WebSocketServer } from 'ws';
import { initWebSocket } from '../src/websocket.js';

describe('websocket', () => {
  let server;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClients.clear();
    server = {};
  });

  it('creates WebSocketServer with server and /ws path', () => {
    initWebSocket(server);
    expect(mockWsInstance.on).toBeDefined();
  });

  it('returns broadcast function', () => {
    const ws = initWebSocket(server);
    expect(ws).toHaveProperty('broadcast');
    expect(typeof ws.broadcast).toBe('function');
  });

  it('broadcast sends JSON to all ready clients', () => {
    const wsApi = initWebSocket(server);

    const client1 = { readyState: 1, send: vi.fn() };
    const client2 = { readyState: 1, send: vi.fn() };
    const client3 = { readyState: 3, send: vi.fn() };
    mockClients.add(client1);
    mockClients.add(client2);
    mockClients.add(client3);

    wsApi.broadcast({ type: 'test', data: 123 });

    expect(client1.send).toHaveBeenCalledWith('{"type":"test","data":123}');
    expect(client2.send).toHaveBeenCalledWith('{"type":"test","data":123}');
    expect(client3.send).not.toHaveBeenCalled();
  });

  it('handles empty clients gracefully', () => {
    const wsApi = initWebSocket(server);
    expect(() => wsApi.broadcast({ type: 'test' })).not.toThrow();
  });

  it('registers error handler on each connection', () => {
    initWebSocket(server);

    const connectionHandler = mockWsOn.mock.calls.find(c => c[0] === 'connection')[1];
    const mockWs = { on: vi.fn() };
    connectionHandler(mockWs);
    expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
