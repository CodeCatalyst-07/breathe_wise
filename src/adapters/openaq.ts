import { z } from "zod";
import type {
  AirQualityProvider,
  AirQualitySnapshot,
  Location,
  ProviderError,
  Result,
} from "../core";
import { err, ok } from "../core";
import { ATTRIBUTION_OPENAQ } from "../lib/constants";
import { haversineDistanceKm } from "../lib/geo";
import { fetchJson, validateCoordinates } from "./http";

const OpenAqLocationsResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      name: z.string().optional(),
      coordinates: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
      sensors: z
        .array(
          z.object({
            id: z.number(),
            name: z.string().optional(),
            parameter: z.object({
              name: z.string(),
            }),
            latest: z
              .object({
                value: z.number(),
                datetime: z.object({ utc: z.string() }).optional(),
              })
              .optional(),
          }),
        )
        .optional(),
      datetimeLast: z.object({ utc: z.string() }).nullish(),
    }),
  ),
});

const OpenAqLatestResponseSchema = z.object({
  results: z.array(
    z.object({
      datetime: z.object({ utc: z.string() }),
      value: z.number(),
      parameter: z.object({
        name: z.string(),
      }),
    }),
  ),
});

export interface OpenAqAdapterConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly radiusKm?: number;
  readonly maxAgeMinutes?: number;
  readonly fetchFn?: typeof fetch;
  readonly nowFn?: () => number;
}

const MAX_PLAUSIBLE_PM25 = 1500;

export class OpenAqAdapter implements AirQualityProvider {
  public static readonly ATTRIBUTION = ATTRIBUTION_OPENAQ;

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly radiusKm: number;
  private readonly maxAgeMinutes: number;
  private readonly fetchFn?: typeof fetch;
  private readonly nowFn: () => number;

  public constructor(config: OpenAqAdapterConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.openaq.org/v3";
    this.radiusKm = config.radiusKm ?? 25;
    this.maxAgeMinutes = config.maxAgeMinutes ?? 180;
    this.fetchFn = config.fetchFn;
    this.nowFn = config.nowFn ?? (() => Date.now());
  }

  public async getAirQuality(
    location: Location,
  ): Promise<Result<AirQualitySnapshot, ProviderError>> {
    if (!this.apiKey || this.apiKey.trim() === "") {
      return err({
        code: "misconfigured",
        message: "OpenAQ API key is missing or not configured",
        retryable: false,
      });
    }

    try {
      validateCoordinates(location.lat, location.lng);
    } catch (e) {
      return err({ code: "invalid_response", message: (e as Error).message, retryable: false });
    }

    const radiusMeters = Math.round(this.radiusKm * 1000);
    const params = new URLSearchParams({
      coordinates: `${location.lat},${location.lng}`,
      radius: radiusMeters.toString(),
      limit: "10",
    });

    const url = `${this.baseUrl}/locations?${params.toString()}`;
    const headers = { "X-API-Key": this.apiKey };

    const locResult = await fetchJson(url, {
      schema: OpenAqLocationsResponseSchema,
      headers,
      fetchFn: this.fetchFn,
      timeoutMs: 8000,
      retries: 2,
    });

    if (!locResult.ok) {
      return locResult;
    }

    const locations = locResult.value.results;
    if (locations.length === 0) {
      return err({
        code: "not_found",
        message: `No OpenAQ ground stations found within ${this.radiusKm} km radius`,
        retryable: false,
      });
    }

    // Filter to stations with PM2.5 sensor and find nearest
    const candidates = locations
      .filter((loc) =>
        loc.sensors?.some(
          (s) =>
            s.parameter.name.toLowerCase() === "pm25" || s.parameter.name.toLowerCase() === "pm2_5",
        ),
      )
      .map((loc) => ({
        loc,
        distanceKm: haversineDistanceKm(
          location.lat,
          location.lng,
          loc.coordinates.latitude,
          loc.coordinates.longitude,
        ),
      }))
      .filter((c) => c.distanceKm <= this.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (candidates.length === 0) {
      return err({
        code: "not_found",
        message: `No active PM2.5 ground stations found within ${this.radiusKm} km`,
        retryable: false,
      });
    }

    const nearest = candidates[0]!;
    let pm25: number | undefined;
    let pm10: number | undefined;
    let observedAt: string | undefined;

    // Check if latest measurements are embedded in sensor objects
    const pm25Sensor = nearest.loc.sensors?.find(
      (s) =>
        s.parameter.name.toLowerCase() === "pm25" || s.parameter.name.toLowerCase() === "pm2_5",
    );
    const pm10Sensor = nearest.loc.sensors?.find((s) => s.parameter.name.toLowerCase() === "pm10");

    if (pm25Sensor?.latest) {
      pm25 = pm25Sensor.latest.value;
      observedAt = pm25Sensor.latest.datetime?.utc ?? nearest.loc.datetimeLast?.utc;
      if (pm10Sensor?.latest) {
        pm10 = pm10Sensor.latest.value;
      }
    } else {
      // Fetch latest endpoint for location
      const latestUrl = `${this.baseUrl}/locations/${nearest.loc.id}/latest`;
      const latestResult = await fetchJson(latestUrl, {
        schema: OpenAqLatestResponseSchema,
        headers,
        fetchFn: this.fetchFn,
        timeoutMs: 8000,
        retries: 2,
      });

      if (!latestResult.ok) {
        return latestResult;
      }

      for (const item of latestResult.value.results) {
        const param = item.parameter.name.toLowerCase();
        if (param === "pm25" || param === "pm2_5") {
          pm25 = item.value;
          observedAt = item.datetime.utc;
        } else if (param === "pm10") {
          pm10 = item.value;
        }
      }
    }

    if (pm25 === undefined || !observedAt) {
      return err({
        code: "not_found",
        message: `No recent PM2.5 measurement records available for station ${nearest.loc.id}`,
        retryable: false,
      });
    }

    // Check plausibility
    if (pm25 < 0 || pm25 > MAX_PLAUSIBLE_PM25) {
      return err({
        code: "invalid_response",
        message: `Implausible PM2.5 value observed: ${pm25} ug/m3 (allowed range 0-${MAX_PLAUSIBLE_PM25})`,
        retryable: false,
      });
    }

    // Check staleness
    const obsTime = new Date(observedAt).getTime();
    const ageMinutes = (this.nowFn() - obsTime) / (60 * 1000);
    if (ageMinutes > this.maxAgeMinutes) {
      return err({
        code: "invalid_response",
        message: `Measurement is stale (${Math.round(ageMinutes)}m old, max allowed: ${this.maxAgeMinutes}m)`,
        retryable: false,
      });
    }

    return ok({
      pm25,
      pm10,
      source: "openaq",
      observedAt,
      kind: "measured",
      stationDistanceKm: nearest.distanceKm,
      hourlyForecast: [],
    });
  }
}
