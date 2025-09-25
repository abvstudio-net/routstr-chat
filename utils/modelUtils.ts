export function parseModelKey(key: string): { id: string; base: string | null } {
  const separatorIndex = key.indexOf('@@');
  if (separatorIndex === -1) {
    return { id: key, base: null };
  }
  return { id: key.slice(0, separatorIndex), base: key.slice(separatorIndex + 2) };
}

export function normalizeBaseUrl(base?: string | null): string | null {
  if (!base || typeof base !== 'string' || base.length === 0) return null;
  const withProto = base.startsWith('http') ? base : `https://${base}`;
  return withProto.endsWith('/') ? withProto : `${withProto}/`;
}
