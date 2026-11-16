export function httpRetryAfter(value: string | null, now: number): number | null {
  if (value === null || !value.trim()) return null;
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(value.trim())) {
    const ms = Math.ceil(parseFloat(value) * 1000);
    return Number.isSafeInteger(ms) && ms <= Number.MAX_SAFE_INTEGER - now ? ms : null;
  }
  if (!/^[A-Za-z]{3}, [0-9]{2} [A-Za-z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/.test(value.trim())) return null;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}
