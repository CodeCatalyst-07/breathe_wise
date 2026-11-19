import { logger } from "../lib/logger";

export const CACHE_TTL_OPENAQ_MS = 10 * 60 * 1000; // 10 minutes
export const CACHE_TTL_OPEN_METEO_MS = 30 * 60 * 1000; // 30 minutes
export const CACHE_TTL_WEATHER_MS = 30 * 60 * 1000; // 30 minutes
export const CACHE_TTL_GEOCODING_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CacheOptions {
  readonly ttlMs?: number;
  readonly maxStaleMs?: number;
}

interface CacheRecord<T> {
  readonly value: T;
  readonly expiresAt: number;
  readonly staleUntil: number;
}

export function buildCoordinateCacheKey(prefix: string, lat: number, lng: number): string {
  return `${prefix}:${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * In-memory TTL + LRU cache with single-flight deduplication and stale-on-error fallback.
 */
export class InMemoryCache<T> {
  private readonly store = new Map<string, CacheRecord<T>>();
  private readonly pending = new Map<string, Promise<T>>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly nowFn: () => number;

  public constructor(
    options: {
      maxSize?: number;
      defaultTtlMs?: number;
      nowFn?: () => number;
    } = {},
  ) {
    this.maxSize = options.maxSize ?? 500;
    this.defaultTtlMs = options.defaultTtlMs ?? CACHE_TTL_OPEN_METEO_MS;
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  public get(key: string): T | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;

    const now = this.nowFn();
    if (now > record.expiresAt) {
      return undefined;
    }

    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, record);
    return record.value;
  }

  public set(key: string, value: T, options: CacheOptions = {}): void {
    const now = this.nowFn();
    const ttl = options.ttlMs ?? this.defaultTtlMs;
    const maxStale = options.maxStaleMs ?? ttl * 2;

    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // Evict oldest entry (LRU)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: now + ttl,
      staleUntil: now + ttl + maxStale,
    });
  }

  public async getOrSet(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const inFlight = this.pending.get(key);
    if (inFlight) {
      return inFlight;
    }

    const promise = (async () => {
      try {
        const fresh = await fetchFn();
        this.set(key, fresh, options);
        return fresh;
      } catch (error) {
        const record = this.store.get(key);
        const now = this.nowFn();
        if (record && now <= record.staleUntil) {
          logger.warn("Upstream fetch failed; serving stale cache entry", {
            key,
            error: (error as Error).message,
          });
          return record.value;
        }
        throw error;
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, promise);
    return promise;
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: string): boolean {
    return this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
    this.pending.clear();
  }

  public size(): number {
    return this.store.size;
  }
}
