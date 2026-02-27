export function parseLimit(searchParams: URLSearchParams, defaultLimit: number, maxLimit: number) {
  const raw = Number(searchParams.get("limit") || defaultLimit);
  if (!Number.isFinite(raw)) return defaultLimit;
  return Math.min(maxLimit, Math.max(1, Math.trunc(raw)));
}

export function parsePage(searchParams: URLSearchParams, defaultPage = 1) {
  const raw = Number(searchParams.get("page") || defaultPage);
  if (!Number.isFinite(raw)) return defaultPage;
  return Math.max(1, Math.trunc(raw));
}

export function parseBooleanFlag(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) === "1";
}
