import type {
  AirQualityProvider,
  AirQualitySnapshot,
  Location,
  ProviderError,
  Result,
} from "../core";
import { err, ok } from "../core";
import { logger } from "../lib/logger";

export interface AirQualityCompositeConfig {
  readonly openAq: AirQualityProvider;
  readonly openMeteo: AirQualityProvider;
  readonly divergenceThreshold?: number;
}

/**
 * Composite Air Quality Provider combining physical ground station observations (OpenAQ)
 * with regional numerical dispersion forecasts (Open-Meteo CAMS).
 *
 * Implements a 4-case fallback matrix:
 * 1. OpenAQ OK + Open-Meteo OK: Current observation from OpenAQ, forecast from Open-Meteo.
 *    Divergence logged if measured vs. model exceeds threshold (> 2.0x).
 * 2. OpenAQ Fails + Open-Meteo OK: Both current and forecast from Open-Meteo model.
 * 3. OpenAQ OK + Open-Meteo Fails: Current from OpenAQ; empty forecast array.
 * 4. Both Fail: Returns upstream_error.
 */
export class AirQualityCompositeAdapter implements AirQualityProvider {
  private readonly openAq: AirQualityProvider;
  private readonly openMeteo: AirQualityProvider;
  private readonly divergenceThreshold: number;

  public constructor(config: AirQualityCompositeConfig) {
    this.openAq = config.openAq;
    this.openMeteo = config.openMeteo;
    this.divergenceThreshold = config.divergenceThreshold ?? 2.0;
  }

  public async getAirQuality(
    location: Location,
  ): Promise<Result<AirQualitySnapshot, ProviderError>> {
    const [openAqSettled, openMeteoSettled] = await Promise.allSettled([
      this.openAq.getAirQuality(location),
      this.openMeteo.getAirQuality(location),
    ]);

    const openAqResult: Result<AirQualitySnapshot, ProviderError> =
      openAqSettled.status === "fulfilled"
        ? openAqSettled.value
        : err({
            code: "upstream_error",
            message: (openAqSettled.reason as Error).message,
            retryable: true,
          });

    const openMeteoResult: Result<AirQualitySnapshot, ProviderError> =
      openMeteoSettled.status === "fulfilled"
        ? openMeteoSettled.value
        : err({
            code: "upstream_error",
            message: (openMeteoSettled.reason as Error).message,
            retryable: true,
          });

    // Case 1: Both successful
    if (openAqResult.ok && openMeteoResult.ok) {
      const openAqSnap = openAqResult.value;
      const openMeteoSnap = openMeteoResult.value;

      const measured = openAqSnap.pm25;
      const model = openMeteoSnap.pm25;
      const denominator = Math.max(Math.min(measured, model), 1);
      const ratio = Math.max(measured, model) / denominator;

      const isDivergent = ratio > this.divergenceThreshold;
      if (isDivergent) {
        logger.warn("Divergence detected between ground sensor and atmospheric model", {
          measuredPm25: measured,
          modelPm25: model,
          ratio: Number(ratio.toFixed(2)),
          lat: location.lat,
          lng: location.lng,
        });
      }

      return ok({
        pm25: openAqSnap.pm25,
        pm10: openAqSnap.pm10 ?? openMeteoSnap.pm10,
        source: "openaq",
        observedAt: openAqSnap.observedAt,
        kind: "measured",
        stationDistanceKm: openAqSnap.stationDistanceKm,
        timezone: openMeteoSnap.timezone ?? openAqSnap.timezone,
        divergence: {
          isDivergent,
          ratio: Number(ratio.toFixed(2)),
          measuredPm25: measured,
          modelPm25: model,
        },
        hourlyForecast: openMeteoSnap.hourlyForecast,
      });
    }

    // Case 2: OpenAQ failed or misconfigured; Open-Meteo succeeded
    if (!openAqResult.ok && openMeteoResult.ok) {
      logger.info("OpenAQ ground data unavailable; falling back to Open-Meteo model", {
        openAqError: openAqResult.error.code,
      });
      return ok(openMeteoResult.value);
    }

    // Case 3: OpenAQ succeeded; Open-Meteo failed
    if (openAqResult.ok && !openMeteoResult.ok) {
      logger.warn("Open-Meteo forecast unavailable; returning OpenAQ current observation only", {
        openMeteoError: openMeteoResult.error.code,
      });
      return ok(openAqResult.value);
    }

    // Case 4: Both failed
    const aqErr = (openAqResult as { ok: false; error: ProviderError }).error;
    const meteoErr = (openMeteoResult as { ok: false; error: ProviderError }).error;

    return err({
      code: "upstream_error",
      message: `All air quality providers failed. OpenAQ: ${aqErr.message}; Open-Meteo: ${meteoErr.message}`,
      retryable: aqErr.retryable || meteoErr.retryable,
    });
  }
}
