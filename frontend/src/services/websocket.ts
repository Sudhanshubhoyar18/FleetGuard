type MessageListener = (data: any) => void;

class FleetGuardWsClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MessageListener>> = new Map();
  private reconnectTimeout: any = null;
  private isExplicitlyClosed = false;
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  public isConnected = false;

  connect() {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws';
    this.isExplicitlyClosed = false;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
        console.log('[WebSocket] Connected to FleetGuard live telemetry stream');
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const type = parsed.type;
          const data = parsed.data;

          if (type && this.listeners.has(type)) {
            const handlers = this.listeners.get(type)!;
            for (const handler of handlers) {
              handler(data);
            }
          }

          // Also notify global wildcard listeners
          if (this.listeners.has('*')) {
            const wildcards = this.listeners.get('*')!;
            for (const handler of wildcards) {
              handler(parsed);
            }
          }
        } catch (e) {
          // ignore non-json messages
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        if (!this.isExplicitlyClosed) {
          this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Connection error:', err);
        if (this.ws) this.ws.close();
      };
    } catch (e) {
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    }
  }

  on(type: string, listener: MessageListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.off(type, listener);
    };
  }

  off(type: string, listener: MessageListener) {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.delete(listener);
    }
  }

  onStatusChange(callback: (connected: boolean) => void) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private notifyStatus(status: boolean) {
    for (const cb of this.statusListeners) {
      cb(status);
    }
  }

  close() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) this.ws.close();
  }
}

export const wsClient = new FleetGuardWsClient();
