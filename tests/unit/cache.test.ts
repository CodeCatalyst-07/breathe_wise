import { describe, expect, it, vi } from "vitest";
import type { AirQualityPort, GeocodingPort, WeatherPort } from "@/core";
import { ok } from "@/core";
import { buildCoordinateCacheKey, InMemoryCache } from "@/server/cache";
import {
  CachedAirQualityAdapter,
  CachedGeocodingAdapter,
  CachedWeatherAdapter,
} from "@/server/cached-adapters";

describe("InMemoryCache", () => {
  it("stores and retrieves values before TTL expiration", () => {
    let now = 1000;
    const cache = new InMemoryCache<string>({
      defaultTtlMs: 500,
      nowFn: () => now,
    });

    cache.set("key1", "val1");
    expect(cache.get("key1")).toBe("val1");

    now = 1400; // within 500ms TTL
    expect(cache.get("key1")).toBe("val1");

    now = 1600; // expired
    expect(cache.get("key1")).toBeUndefined();
  });

  it("evicts the least recently used item when maxSize is reached", () => {
    const cache = new InMemoryCache<string>({ maxSize: 2 });
    cache.set("a", "1");
    cache.set("b", "2");

    // Access "a" to make it more recently used than "b"
    expect(cache.get("a")).toBe("1");

    // Adding "c" should evict "b"
    cache.set("c", "3");

    expect(cache.get("a")).toBe("1");
    expect(cache.get("c")).toBe("3");
    expect(cache.get("b")).toBeUndefined();
  });

  it("deduplicates simultaneous in-flight requests (single-flight)", async () => {
    const cache = new InMemoryCache<number>();
    const fetchFn = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });

    const [res1, res2, res3] = await Promise.all([
      cache.getOrSet("key", fetchFn),
      cache.getOrSet("key", fetchFn),
      cache.getOrSet("key", fetchFn),
    ]);

    expect(res1).toBe(42);
    expect(res2).toBe(42);
    expect(res3).toBe(42);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("serves stale value when upstream fetch fails and value is within stale window", async () => {
    let now = 1000;
    const cache = new InMemoryCache<string>({
      defaultTtlMs: 200,
      nowFn: () => now,
    });

    // Populate initial cache
    await cache.getOrSet("key", async () => "fresh-value", {
      ttlMs: 200,
      maxStaleMs: 500,
    });

    now = 1300; // Expired (past 200ms), but within stale window (past up to 500ms more, until 1700)
    expect(cache.get("key")).toBeUndefined();

    // Upstream failure during refresh
    const failingFetch = vi.fn().mockRejectedValue(new Error("Network glitch"));
    const fallbackValue = await cache.getOrSet("key", failingFetch, {
      ttlMs: 200,
      maxStaleMs: 500,
    });

    expect(fallbackValue).toBe("fresh-value");
    expect(failingFetch).toHaveBeenCalledTimes(1);
  });

  it("throws error when fetch fails and no stale value is available", async () => {
    const cache = new InMemoryCache<string>();
    const failingFetch = vi.fn().mockRejectedValue(new Error("Fatal upstream crash"));

    await expect(cache.getOrSet("key", failingFetch)).rejects.toThrow("Fatal upstream crash");
  });

  it("buildCoordinateCacheKey rounds coordinates to 2 decimal places", () => {
    const key = buildCoordinateCacheKey("aq", 28.6139123, 77.2090456);
    expect(key).toBe("aq:28.61,77.21");
  });

  describe("Cached Adapter Wrappers", () => {
    it("caches air quality requests by rounded coordinate key", async () => {
      const mockAq = {
        getAirQuality: vi.fn().mockResolvedValue(ok({ pm25: 50 })),
      };
      const cached = new CachedAirQualityAdapter(mockAq as unknown as AirQualityPort);
      await cached.getAirQuality({ lat: 28.6139, lng: 77.209, label: "Delhi" });
      await cached.getAirQuality({ lat: 28.6141, lng: 77.2091, label: "Delhi" }); // Rounds to same 28.61, 77.21
      expect(mockAq.getAirQuality).toHaveBeenCalledTimes(1);
    });

    it("caches weather requests by rounded coordinate key", async () => {
      const mockWeather = {
        getWeather: vi.fn().mockResolvedValue(ok({ temperatureC: 22 })),
      };
      const cached = new CachedWeatherAdapter(mockWeather as unknown as WeatherPort);
      await cached.getWeather({ lat: 28.6139, lng: 77.209, label: "Delhi" });
      await cached.getWeather({ lat: 28.6139, lng: 77.209, label: "Delhi" });
      expect(mockWeather.getWeather).toHaveBeenCalledTimes(1);
    });

    it("caches geocoding search queries by normalized key", async () => {
      const mockGeo = {
        searchLocation: vi.fn().mockResolvedValue(ok([{ label: "Delhi" }])),
      };
      const cached = new CachedGeocodingAdapter(mockGeo as unknown as GeocodingPort);
      await cached.searchLocation("Delhi ");
      await cached.searchLocation("  delhi");
      expect(mockGeo.searchLocation).toHaveBeenCalledTimes(1);
    });
  });
});
