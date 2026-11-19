import { z } from "zod";
import type {
  AirQualityProvider,
  AirQualitySnapshot,
  HourlyAirQualityPoint,
  HourlyWeatherRecord,
  Location,
  ProviderError,
  Result,
  WeatherProvider,
  WeatherSnapshot,
} from "../core";
import { err, ok } from "../core";
import { ATTRIBUTION_OPEN_METEO_CAMS } from "../lib/constants";
import { fetchJson, validateCoordinates } from "./http";

const OpenMeteoAirQualityResponseSchema = z.object({
  timezone: z.string().nullish(),
  current: z
    .object({
      time: z.string(),
      pm2_5: z.number().nonnegative().nullish(),
      pm10: z.number().nonnegative().nullish(),
    })
    .optional(),
  hourly: z.object({
    time: z.array(z.string()),
    pm2_5: z.array(z.number().nonnegative().nullish()),
    pm10: z.array(z.number().nonnegative().nullish()).optional(),
  }),
});

const OpenMeteoWeatherResponseSchema = z.object({
  timezone: z.string().nullish(),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullish()),
    relative_humidity_2m: z.array(z.number().nullish()),
    wind_speed_10m: z.array(z.number().nullish()),
    wind_direction_10m: z.array(z.number().nullish()).optional(),
    precipitation: z.array(z.number().nullish()),
  }),
});

export interface OpenMeteoAdapterConfig {
  readonly airQualityBaseUrl?: string;
  readonly weatherBaseUrl?: string;
  readonly fetchFn?: typeof fetch;
}

function toUtcIso(timeStr: string): string {
  if (timeStr.endsWith("Z")) return timeStr;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timeStr)) {
    return `${timeStr}:00Z`;
  }
  return new Date(timeStr).toISOString();
}

/**
 * Open-Meteo adapter providing atmospheric air quality (CAMS model) and meteorological data.
 *
 * NOTE: CAMS ENSEMBLE air quality forecasts provide regional model estimates
 * with a grid resolution of ~10-25 km. They are regional predictions, not hyper-local
 * street-level sensor readings.
 */
export class OpenMeteoAdapter implements AirQualityProvider, WeatherProvider {
  public static readonly ATTRIBUTION = ATTRIBUTION_OPEN_METEO_CAMS;

  private readonly airQualityBaseUrl: string;
  private readonly weatherBaseUrl: string;
  private readonly fetchFn?: typeof fetch;

  public constructor(config: OpenMeteoAdapterConfig = {}) {
    this.airQualityBaseUrl =
      config.airQualityBaseUrl ?? "https://air-quality-api.open-meteo.com/v1/air-quality";
    this.weatherBaseUrl = config.weatherBaseUrl ?? "https://api.open-meteo.com/v1/forecast";
    this.fetchFn = config.fetchFn;
  }

  public async getAirQuality(
    location: Location,
  ): Promise<Result<AirQualitySnapshot, ProviderError>> {
    try {
      validateCoordinates(location.lat, location.lng);
    } catch (e) {
      return err({ code: "invalid_response", message: (e as Error).message, retryable: false });
    }

    const params = new URLSearchParams({
      latitude: location.lat.toString(),
      longitude: location.lng.toString(),
      hourly: "pm2_5,pm10",
      current: "pm2_5,pm10",
      forecast_days: "3",
      timezone: "auto",
    });

    const url = `${this.airQualityBaseUrl}?${params.toString()}`;
    const result = await fetchJson(url, {
      schema: OpenMeteoAirQualityResponseSchema,
      fetchFn: this.fetchFn,
      timeoutMs: 8000,
      retries: 2,
    });

    if (!result.ok) {
      return result;
    }

    const data = result.value;
    const hourlyTimes = data.hourly.time;
    const hourlyPm25 = data.hourly.pm2_5;
    const hourlyPm10 = data.hourly.pm10;

    const hourlyForecast: HourlyAirQualityPoint[] = [];
    for (let i = 0; i < hourlyTimes.length; i++) {
      const t = hourlyTimes[i];
      const val = hourlyPm25[i];
      if (t && val !== undefined && val !== null) {
        hourlyForecast.push({
          timestamp: toUtcIso(t),
          pm25: val,
          pm10: hourlyPm10?.[i] ?? undefined,
        });
      }
    }

    const currentPm25 = data.current?.pm2_5 ?? hourlyPm25[0] ?? 0;
    const currentPm10 = data.current?.pm10 ?? hourlyPm10?.[0] ?? undefined;
    const observedAt = data.current?.time
      ? toUtcIso(data.current.time)
      : (hourlyForecast[0]?.timestamp ?? new Date().toISOString());

    return ok({
      pm25: currentPm25,
      pm10: currentPm10,
      source: "open-meteo",
      observedAt,
      kind: "model",
      stationDistanceKm: undefined,
      timezone: data.timezone ?? "UTC",
      hourlyForecast,
    });
  }

  public async getWeather(location: Location): Promise<Result<WeatherSnapshot, ProviderError>> {
    try {
      validateCoordinates(location.lat, location.lng);
    } catch (e) {
      return err({ code: "invalid_response", message: (e as Error).message, retryable: false });
    }

    const params = new URLSearchParams({
      latitude: location.lat.toString(),
      longitude: location.lng.toString(),
      hourly: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation",
      wind_speed_unit: "ms",
      forecast_days: "3",
      timezone: "auto",
    });

    const url = `${this.weatherBaseUrl}?${params.toString()}`;
    const result = await fetchJson(url, {
      schema: OpenMeteoWeatherResponseSchema,
      fetchFn: this.fetchFn,
      timeoutMs: 8000,
      retries: 2,
    });

    if (!result.ok) {
      return result;
    }

    const { hourly, timezone } = result.value;
    const records: HourlyWeatherRecord[] = [];

    for (let i = 0; i < hourly.time.length; i++) {
      const t = hourly.time[i];
      const temp = hourly.temperature_2m[i];
      const humidity = hourly.relative_humidity_2m[i];
      const wind = hourly.wind_speed_10m[i];
      const precip = hourly.precipitation[i];
      const dir = hourly.wind_direction_10m?.[i];

      if (t && temp != null && humidity != null && wind != null && precip != null) {
        records.push({
          timestamp: toUtcIso(t),
          temperatureC: temp,
          humidityPercent: Math.min(100, Math.max(0, humidity)),
          windSpeedMs: Math.max(0, wind),
          windDirectionDeg: dir != null ? Math.min(360, Math.max(0, dir)) : undefined,
          precipitationMm: Math.max(0, precip),
        });
      }
    }

    return ok({ hourly: records, timezone: timezone ?? "UTC" });
  }
}
