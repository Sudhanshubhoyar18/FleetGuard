import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('WebSocketServer');

export interface WsMessage {
  type: string;
  data: any;
  timestamp: string;
}

class FleetGuardWsServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.clients.add(ws);
      const clientIp = req.socket.remoteAddress;
      logger.info(`WebSocket client connected from ${clientIp}. Total active clients: ${this.clients.size}`);

      // Send initial welcome/ready handshake
      this.sendToClient(ws, {
        type: 'CONNECTION_READY',
        data: { message: 'FleetGuard Real-time Telemetry Stream Connected', clientCount: this.clients.size },
        timestamp: new Date().toISOString()
      });

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'PING') {
            this.sendToClient(ws, {
              type: 'PONG',
              data: { time: Date.now() },
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          // ignore non-json pings
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.debug(`WebSocket client disconnected. Remaining clients: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        logger.error(`WebSocket client error: ${err.message}`);
        this.clients.delete(ws);
      });
    });

    // Heartbeat ping every 30 seconds to prune zombie sockets
    this.pingInterval = setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.ping();
          } catch (e) {
            this.clients.delete(client);
          }
        }
      }
    }, 30000);

    logger.info('FleetGuard WebSocket server initialized on path /ws');
  }

  broadcast(type: string, data: any) {
    const message: WsMessage = {
      type,
      data,
      timestamp: new Date().toISOString()
    };
    const payload = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (err: any) {
          logger.error(`Error sending message to client: ${err.message}`);
          this.clients.delete(client);
        }
      }
    }
  }

  private sendToClient(ws: WebSocket, message: WsMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  shutdown() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.wss) {
      for (const client of this.clients) {
        client.close(1001, 'Server shutting down');
      }
      this.wss.close();
    }
  }
}

export const wsServer = new FleetGuardWsServer();
export default wsServer;
