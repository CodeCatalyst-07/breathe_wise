import { z } from "zod";
import type { GeocodingProvider, Language, Location, ProviderError, Result } from "../core";
import { err, ok } from "../core";
import { fetchJson, sanitizeQueryText, validateCoordinates } from "./http";

const OpenMeteoGeocodingResultSchema = z.object({
  id: z.number().nullish(),
  name: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().nullish(),
  admin1: z.string().nullish(),
  admin2: z.string().nullish(),
  admin3: z.string().nullish(),
  timezone: z.string().nullish(),
  country_code: z.string().nullish(),
});

const OpenMeteoGeocodingResponseSchema = z.object({
  results: z.array(OpenMeteoGeocodingResultSchema).nullish(),
  generationtime_ms: z.number().nullish(),
});

export interface GeocodingAdapterConfig {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
}

/**
 * Geocoding adapter backed by the Open-Meteo Geocoding API (no API key required).
 * Provides place name resolution and coordinate rounding.
 */
export class GeocodingAdapter implements GeocodingProvider {
  private readonly baseUrl: string;
  private readonly fetchFn?: typeof fetch;

  public constructor(config: GeocodingAdapterConfig = {}) {
    this.baseUrl = config.baseUrl ?? "https://geocoding-api.open-meteo.com/v1";
    this.fetchFn = config.fetchFn;
  }

  private async executeSearch(
    name: string,
    language: Language,
  ): Promise<Result<Location[], ProviderError>> {
    const params = new URLSearchParams({
      name,
      count: "10",
      language: language === "hi" ? "hi" : "en",
      format: "json",
    });

    const url = `${this.baseUrl}/search?${params.toString()}`;
    const fetchResult = await fetchJson(url, {
      schema: OpenMeteoGeocodingResponseSchema,
      fetchFn: this.fetchFn,
      timeoutMs: 5000,
      retries: 2,
    });

    if (!fetchResult.ok) {
      return fetchResult;
    }

    const items = fetchResult.value.results ?? [];
    const locations: Location[] = items.map((item) => {
      const parts = [item.name, item.admin1, item.country].filter(Boolean);
      return {
        lat: Math.round(item.latitude * 10000) / 10000,
        lng: Math.round(item.longitude * 10000) / 10000,
        label: parts.join(", "),
        timezone: item.timezone ?? undefined,
      };
    });

    return ok(locations);
  }

  /**
   * Searches for matching geographic locations by place name.
   *
   * @param query - Free-form search query (e.g. "Delhi", "Connaught Place, Delhi").
   * @param language - Optional language preference ("en" or "hi").
   * @returns Array of candidate locations matching the search term.
   */
  public async searchLocation(
    query: string,
    language: Language = "en",
  ): Promise<Result<Location[], ProviderError>> {
    const sanitized = sanitizeQueryText(query, 100);
    if (!sanitized || sanitized.length < 2) {
      return ok([]);
    }

    // 1. Attempt primary search with the user's sanitized query
    const primaryResult = await this.executeSearch(sanitized, language);
    if (!primaryResult.ok) {
      return primaryResult;
    }
    if (primaryResult.value.length > 0) {
      return primaryResult;
    }

    // 2. Fallback: If comma-separated (e.g. "Connaught Place, Delhi"), try the main city/token
    if (sanitized.includes(",")) {
      const segments = sanitized
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length >= 2);

      for (const segment of segments) {
        const fallbackRes = await this.executeSearch(segment, language);
        if (fallbackRes.ok && fallbackRes.value.length > 0) {
          return fallbackRes;
        }
      }
    }

    return ok([]);
  }

  /**
   * Browser-supplied coordinate resolver.
   * Rounds coordinates to 2 decimal places to prevent fingerprinting/tracking,
   * returning the standardized label "Current location".
   */
  public async reverseGeocode(lat: number, lng: number): Promise<Result<Location, ProviderError>> {
    try {
      validateCoordinates(lat, lng);
    } catch (e) {
      return err({
        code: "invalid_response",
        message: (e as Error).message,
        retryable: false,
      });
    }

    return ok({
      lat: Math.round(lat * 100) / 100,
      lng: Math.round(lng * 100) / 100,
      label: "Current location",
    });
  }
}
