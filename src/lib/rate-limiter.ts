/**
 * Simple in-memory token bucket rate limiter.
 * Suitable for single-process deployments (10-person team).
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * Check whether a request identified by `key` is within the rate limit.
 *
 * @param key           Unique identifier (e.g. userId or IP)
 * @param maxTokens     Maximum tokens in the bucket (burst capacity)
 * @param refillIntervalMs  How often one token is added back (e.g. 3600000/5 = 720000 for 5/hour)
 */
export function checkRateLimit(
  key: string,
  maxTokens: number,
  refillIntervalMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens - 1, lastRefill: now };
    buckets.set(key, bucket);
    return { allowed: true };
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / refillIntervalMs);

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = bucket.lastRefill + tokensToAdd * refillIntervalMs;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { allowed: true };
  }

  // Not allowed — compute when next token arrives
  const timeUntilRefill = refillIntervalMs - (now - bucket.lastRefill);
  const retryAfter = Math.ceil(timeUntilRefill / 1000);

  return { allowed: false, retryAfter: Math.max(1, retryAfter) };
}

/**
 * Reset all rate limit state. Useful for testing.
 */
export function resetRateLimits(): void {
  buckets.clear();
}
