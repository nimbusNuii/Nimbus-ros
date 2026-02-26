type Bucket = {
  hits: number[];
};

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitBuckets: Map<string, Bucket> | undefined;
}

function getBucketStore() {
  if (!globalThis.__rateLimitBuckets) {
    globalThis.__rateLimitBuckets = new Map<string, Bucket>();
  }
  return globalThis.__rateLimitBuckets;
}

export function checkRateLimit(key: string, windowMs: number, maxRequests: number) {
  const now = Date.now();
  const store = getBucketStore();
  const bucket = store.get(key) || { hits: [] };
  const minTime = now - windowMs;

  bucket.hits = bucket.hits.filter((time) => time >= minTime);
  if (bucket.hits.length >= maxRequests) {
    const retryAt = bucket.hits[0] + windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((retryAt - now) / 1000));
    store.set(key, bucket);
    return {
      allowed: false,
      retryAfterSec
    };
  }

  bucket.hits.push(now);
  store.set(key, bucket);
  return {
    allowed: true,
    retryAfterSec: 0
  };
}
