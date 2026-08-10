/** Shared coercion / timing helpers for agent-ui URL handling. */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function asSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function asNumber(
  value: number | string | string[] | undefined,
): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = asSingle(
    typeof value === 'string' || Array.isArray(value) ? value : undefined,
  );
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function asBool(value: boolean | string | string[] | undefined): boolean {
  if (typeof value === 'boolean') return value;
  const raw = asSingle(
    typeof value === 'string' || Array.isArray(value) ? value : undefined,
  );
  if (!raw) return false;
  return raw === '1' || raw.toLowerCase() === 'true';
}

export function asTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  if (Array.isArray(value)) return asTruthyFlag(value[0]);
  return false;
}
