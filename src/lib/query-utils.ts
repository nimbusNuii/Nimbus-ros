export function parseLimit(searchParams: URLSearchParams, defaultLimit: number, maxLimit: number) {
  const raw = Number(searchParams.get("limit") || defaultLimit);
  if (!Number.isFinite(raw)) return defaultLimit;
  return Math.min(maxLimit, Math.max(1, Math.trunc(raw)));
}

export function parseBooleanFlag(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) === "1";
}
