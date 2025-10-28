// Safe stringify that avoids circular references and large depth explosions
export function safeStringify(value: unknown, space: number = 0, maxDepth: number = 5): string {
  const seen = new WeakSet<object>();

  function serialize(val: any, depth: number): any {
    if (depth > maxDepth) return '[MaxDepth]';
    if (val === null || typeof val !== 'object') return val;
    if (seen.has(val)) return '[Circular]';
    seen.add(val);

    if (Array.isArray(val)) return val.map((v) => serialize(v, depth + 1));

    const out: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      try {
        out[k] = serialize(val[k], depth + 1);
      } catch {
        out[k] = '[Unserializable]';
      }
    }
    return out;
  }

  try {
    return JSON.stringify(serialize(value, 0), null, space);
  } catch {
    return '[UnserializableRoot]';
  }
}


















