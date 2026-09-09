type Listener = (data: string) => void;

class EventBus {
  private channels = new Map<string, Set<Listener>>();

  subscribe(channel: string, listener: Listener): () => void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(listener);

    return () => {
      this.channels.get(channel)?.delete(listener);
      if (this.channels.get(channel)?.size === 0) {
        this.channels.delete(channel);
      }
    };
  }

  publish(channel: string, data: string) {
    const listeners = this.channels.get(channel);
    if (listeners) {
      for (const listener of listeners) {
        listener(data);
      }
    }
  }
}

export const eventBus = new EventBus();

// Per-branch display SSE connection limiter (single instance only).
const MAX_DISPLAY_CONNECTIONS = 20;
const displayConnections = new Map<string, number>();

export function acquireDisplayConnection(branchId: string): boolean {
  const current = displayConnections.get(branchId) ?? 0;
  if (current >= MAX_DISPLAY_CONNECTIONS) return false;
  displayConnections.set(branchId, current + 1);
  return true;
}

export function releaseDisplayConnection(branchId: string) {
  const current = displayConnections.get(branchId) ?? 0;
  if (current <= 1) {
    displayConnections.delete(branchId);
  } else {
    displayConnections.set(branchId, current - 1);
  }
}
