import type {
  AirQualityPort,
  AirQualitySnapshot,
  GeocodingPort,
  Location,
  ProviderError,
  Result,
  WeatherPort,
  WeatherSnapshot,
} from "@/core";
import {
  buildCoordinateCacheKey,
  CACHE_TTL_GEOCODING_MS,
  CACHE_TTL_OPENAQ_MS,
  CACHE_TTL_WEATHER_MS,
  InMemoryCache,
} from "./cache";

export class CachedAirQualityAdapter implements AirQualityPort {
  public constructor(
    private readonly inner: AirQualityPort,
    private readonly cache = new InMemoryCache<Result<AirQualitySnapshot, ProviderError>>({
      defaultTtlMs: CACHE_TTL_OPENAQ_MS,
    }),
  ) {}

  public async getAirQuality(
    location: Location,
  ): Promise<Result<AirQualitySnapshot, ProviderError>> {
    const key = buildCoordinateCacheKey("aq", location.lat, location.lng);
    return this.cache.getOrSet(key, () => this.inner.getAirQuality(location), {
      ttlMs: CACHE_TTL_OPENAQ_MS,
    });
  }
}

export class CachedWeatherAdapter implements WeatherPort {
  public constructor(
    private readonly inner: WeatherPort,
    private readonly cache = new InMemoryCache<Result<WeatherSnapshot, ProviderError>>({
      defaultTtlMs: CACHE_TTL_WEATHER_MS,
    }),
  ) {}

  public async getWeather(location: Location): Promise<Result<WeatherSnapshot, ProviderError>> {
    const key = buildCoordinateCacheKey("weather", location.lat, location.lng);
    return this.cache.getOrSet(key, () => this.inner.getWeather(location), {
      ttlMs: CACHE_TTL_WEATHER_MS,
    });
  }
}

export class CachedGeocodingAdapter implements GeocodingPort {
  private readonly searchCache: InMemoryCache<Result<Location[], ProviderError>>;
  private readonly revCache: InMemoryCache<Result<Location, ProviderError>>;

  public constructor(
    private readonly inner: GeocodingPort,
    cache?: InMemoryCache<Result<Location[], ProviderError>>,
  ) {
    this.searchCache =
      cache ??
      new InMemoryCache<Result<Location[], ProviderError>>({
        defaultTtlMs: CACHE_TTL_GEOCODING_MS,
      });
    this.revCache = new InMemoryCache<Result<Location, ProviderError>>({
      defaultTtlMs: CACHE_TTL_GEOCODING_MS,
    });
  }

  public async searchLocation(query: string): Promise<Result<Location[], ProviderError>> {
    const key = `geo:${query.trim().toLowerCase()}`;
    return this.searchCache.getOrSet(key, () => this.inner.searchLocation(query), {
      ttlMs: CACHE_TTL_GEOCODING_MS,
    });
  }

  public async reverseGeocode(lat: number, lng: number): Promise<Result<Location, ProviderError>> {
    const key = `geo:rev:${lat.toFixed(2)},${lng.toFixed(2)}`;
    return this.revCache.getOrSet(key, () => this.inner.reverseGeocode(lat, lng), {
      ttlMs: CACHE_TTL_GEOCODING_MS,
    });
  }
}
