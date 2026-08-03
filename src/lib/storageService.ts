// Wrapper de storage - localStorage puro (sem Capacitor no MVP do PlanSeven).
export const storage = {
  async get<T = string>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  },
  async set(key: string, value: unknown): Promise<void> {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, str);
  },
  async remove(key: string): Promise<void> { localStorage.removeItem(key); },
  async clear(): Promise<void> { localStorage.clear(); },
};
