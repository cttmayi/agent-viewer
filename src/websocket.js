import { WebSocketServer } from 'ws';

let wss = null;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('error', () => {});
  });

  return {
    broadcast(data) {
      const msg = JSON.stringify(data);
      for (const client of wss.clients) {
        if (client.readyState === 1) {
          client.send(msg);
        }
      }
    }
  };
}
