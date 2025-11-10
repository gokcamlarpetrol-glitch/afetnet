export type Handler<T = any> = (payload: T) => void;

export class SimpleEventEmitter {
  private listeners = new Map<string, Set<Handler>>();

  on<T = any>(event: string, handler: Handler<T>): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler as Handler);
    this.listeners.set(event, set);
  }

  off<T = any>(event: string, handler: Handler<T>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler as Handler);
    if (set.size === 0) this.listeners.delete(event);
  }

  once<T = any>(event: string, handler: Handler<T>): void {
    const wrapper: Handler<T> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    this.on(event, wrapper);
  }

  emit<T = any>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try { fn(payload as T); } catch { /* swallow to avoid crashes */ }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}

export { SimpleEventEmitter as default };