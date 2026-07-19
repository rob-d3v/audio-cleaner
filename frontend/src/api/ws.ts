// Small WebSocket manager with automatic, backed-off reconnection.
// Used for /ws/jobs (progress) and /ws/meter (live level metering).
// Deliberately framework-agnostic — React wiring lives in the hooks that
// consume `subscribe()`.

export type WsStatus = "connecting" | "open" | "closed";

type MessageHandler<T> = (message: T) => void;
type StatusHandler = (status: WsStatus) => void;

function resolveWsUrl(path: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path.startsWith("/") ? path : `/${path}`}`;
}

export class WsChannel<T = unknown> {
  private url: string;
  private socket: WebSocket | null = null;
  private handlers = new Set<MessageHandler<T>>();
  private statusHandlers = new Set<StatusHandler>();
  private status: WsStatus = "closed";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(path: string, opts: { baseBackoffMs?: number; maxBackoffMs?: number } = {}) {
    this.url = resolveWsUrl(path);
    this.baseBackoffMs = opts.baseBackoffMs ?? 500;
    this.maxBackoffMs = opts.maxBackoffMs ?? 8000;
  }

  private setStatus(status: WsStatus) {
    this.status = status;
    for (const handler of this.statusHandlers) handler(status);
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.closedByUser = false;
    this.setStatus("connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus("open");
    };

    socket.onmessage = (event) => {
      let parsed: T;
      try {
        parsed = JSON.parse(event.data as string) as T;
      } catch {
        return;
      }
      for (const handler of this.handlers) handler(parsed);
    };

    socket.onclose = () => {
      this.setStatus("closed");
      this.socket = null;
      if (!this.closedByUser) this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      this.maxBackoffMs,
      this.baseBackoffMs * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByUser) this.connect();
    }, delay);
  }

  disconnect() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.setStatus("closed");
  }

  send(data: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }

  subscribe(handler: MessageHandler<T>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  subscribeStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): WsStatus {
    return this.status;
  }
}

// Module-level singletons — one socket per channel, shared across every
// component that needs job progress or meter data instead of opening a
// fresh connection per consumer.
let jobsChannel: WsChannel<import("./types").WsJobMessage> | null = null;
let meterChannel: WsChannel<import("./types").WsMeterChannelMessage> | null = null;

export function getJobsChannel() {
  if (!jobsChannel) jobsChannel = new WsChannel("/ws/jobs");
  return jobsChannel;
}

export function getMeterChannel() {
  if (!meterChannel) meterChannel = new WsChannel("/ws/meter");
  return meterChannel;
}
