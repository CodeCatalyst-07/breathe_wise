import crypto from "node:crypto";
import type { ClockPort } from "@/core";

/**
 * ARCHITECTURAL NOTICE - SERVERLESS / MULTI-INSTANCE LIMITATION:
 * This sliding-window rate limiter stores request timestamps in process memory.
 * In a multi-replica serverless deployment (e.g. AWS Lambda, Vercel multi-region),
 * rate-limit state is isolated per cold-start instance. For multi-region enterprise
 * scale, backing this interface with Redis or Cloudflare KV is recommended.
 * For single-instance node runtimes and edge container workers, it provides immediate,
 * zero-overhead abuse protection with bounded memory usage.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds?: number;
}

export type RouteRateLimitType =
  "advice" | "geocode" | "explain" | "ask" | "parse-profile" | "health";

/** Default base requests per minute */
export const DEFAULT_BASE_RATE_LIMIT = 20;

/** Multipliers relative to base limit */
export const ROUTE_RATE_LIMITS: Record<RouteRateLimitType, (base: number) => number> = {
  advice: (b) => Math.max(1, Math.round(b * 1.0)),
  geocode: (b) => Math.max(1, Math.round(b * 1.5)),
  explain: (b) => Math.max(1, Math.round(b * 0.5)),
  ask: (b) => Math.max(1, Math.round(b * 0.5)),
  "parse-profile": (b) => Math.max(1, Math.round(b * 0.5)),
  health: (b) => Math.max(1, Math.round(b * 3.0)),
};

export class RateLimiter {
  private readonly salt: string;
  private readonly hits: Map<string, number[]> = new Map();
  private readonly windowMs = 60000; // 1 minute sliding window
  private lastCleanupTime = 0;
  private readonly maxTrackedKeys = 10000;

  public constructor(
    private readonly clock?: ClockPort,
    salt?: string,
  ) {
    this.salt = salt ?? crypto.randomBytes(16).toString("hex");
  }

  private getCurrentTime(): number {
    return this.clock ? new Date(this.clock.nowIso()).getTime() : Date.now();
  }

  /**
   * Hashes the client IP with a per-process cryptographic salt using SHA-256.
   * Guarantees raw IP addresses are NEVER retained in memory.
   */
  public hashClientIdentifier(rawIp: string): string {
    return crypto
      .createHash("sha256")
      .update(this.salt + rawIp.trim().toLowerCase())
      .digest("hex");
  }

  /**
   * Evaluates request rate against the sliding window limit for the hashed client key.
   */
  public check(clientKey: string, limit: number): RateLimitResult {
    const now = this.getCurrentTime();
    this.maybeCleanup(now);

    const timestamps = this.hits.get(clientKey) ?? [];
    // Filter out timestamps outside the sliding window
    const windowStart = now - this.windowMs;
    const active = timestamps.filter((t) => t > windowStart);

    if (active.length >= limit) {
      const oldestActive = active[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestActive + this.windowMs - now) / 1000));

      this.hits.set(clientKey, active);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    active.push(now);
    this.hits.set(clientKey, active);

    return {
      allowed: true,
      remaining: Math.max(0, limit - active.length),
    };
  }

  /**
   * Periodic pruning to ensure memory remains strictly bounded.
   */
  public cleanup(now = this.getCurrentTime()): void {
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.hits.entries()) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, active);
      }
    }
    // Hard cap on map size
    if (this.hits.size > this.maxTrackedKeys) {
      const keysToDelete = Array.from(this.hits.keys()).slice(
        0,
        this.hits.size - this.maxTrackedKeys,
      );
      for (const k of keysToDelete) {
        this.hits.delete(k);
      }
    }
    this.lastCleanupTime = now;
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanupTime > this.windowMs || this.hits.size > this.maxTrackedKeys) {
      this.cleanup(now);
    }
  }

  /**
   * Resets rate limiter memory. Useful for unit testing.
   */
  public reset(): void {
    this.hits.clear();
  }
}

let globalRateLimiter: RateLimiter | undefined;

export function getRateLimiter(clock?: ClockPort): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(clock);
  }
  return globalRateLimiter;
}
