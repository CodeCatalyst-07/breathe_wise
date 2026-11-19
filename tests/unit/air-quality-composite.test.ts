import { describe, expect, it, vi } from "vitest";
import { AirQualityCompositeAdapter } from "@/adapters/air-quality-composite";
import type { AirQualityProvider, AirQualitySnapshot, Location } from "@/core";
import { err, ok } from "@/core";
import { logger } from "@/lib/logger";

describe("AirQualityCompositeAdapter Fallback Matrix & Divergence", () => {
  const dummyLoc: Location = { lat: 28.61, lng: 77.21, label: "Delhi" };

  const mockOpenAqSnapshot: AirQualitySnapshot = {
    pm25: 250,
    pm10: 400,
    source: "openaq",
    observedAt: "2026-11-19T06:00:00Z",
    kind: "measured",
    stationDistanceKm: 4.2,
    hourlyForecast: [],
  };

  const mockOpenMeteoSnapshot: AirQualitySnapshot = {
    pm25: 100, // Ratio: 250 / 100 = 2.5x (>2.0x threshold)
    pm10: 160,
    source: "open-meteo",
    observedAt: "2026-11-19T06:00:00Z",
    kind: "model",
    hourlyForecast: [
      { timestamp: "2026-11-19T06:00:00Z", pm25: 100 },
      { timestamp: "2026-11-19T07:00:00Z", pm25: 110 },
    ],
  };

  it("Case 1: OpenAQ and Open-Meteo both OK -> OpenAQ current + Open-Meteo forecast, logs divergence", async () => {
    const openAq: AirQualityProvider = {
      getAirQuality: vi.fn().mockResolvedValue(ok(mockOpenAqSnapshot)),
    };
    const openMeteo: AirQualityProvider = {
      getAirQuality: vi.fn().mockResolvedValue(ok(mockOpenMeteoSnapshot)),
    };
    const warnSpy = vi.spyOn(logger, "warn");

    const composite = new AirQualityCompositeAdapter({ openAq, openMeteo });
    const result = await composite.getAirQuality(dummyLoc);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe("openaq");
      expect(result.value.kind).toBe("measured");
      expect(result.value.pm25).toBe(250);
      expect(result.value.hourlyForecast.length).toBe(2);
    }
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Divergence detected"),
      expect.objectContaining({ ratio: 2.5 }),
    );
  });

  it("Case 2: OpenAQ fails, Open-Meteo OK -> falls back to Open-Meteo entirely", async () => {
    const openAq: AirQualityProvider = {
      getAirQuality: vi
        .fn()
        .mockResolvedValue(err({ code: "not_found", message: "No stations", retryable: false })),
    };
    const openMeteo: AirQualityProvider = {
      getAirQuality: vi.fn().mockResolvedValue(ok(mockOpenMeteoSnapshot)),
    };

    const composite = new AirQualityCompositeAdapter({ openAq, openMeteo });
    const result = await composite.getAirQuality(dummyLoc);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe("open-meteo");
      expect(result.value.kind).toBe("model");
      expect(result.value.pm25).toBe(100);
      expect(result.value.hourlyForecast.length).toBe(2);
    }
  });

  it("Case 3: OpenAQ OK, Open-Meteo fails -> returns OpenAQ with empty forecast", async () => {
    const openAq: AirQualityProvider = {
      getAirQuality: vi.fn().mockResolvedValue(ok(mockOpenAqSnapshot)),
    };
    const openMeteo: AirQualityProvider = {
      getAirQuality: vi
        .fn()
        .mockResolvedValue(err({ code: "timeout", message: "Timeout", retryable: true })),
    };

    const composite = new AirQualityCompositeAdapter({ openAq, openMeteo });
    const result = await composite.getAirQuality(dummyLoc);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe("openaq");
      expect(result.value.hourlyForecast).toEqual([]);
    }
  });

  it("Case 4: Both fail -> returns upstream_error", async () => {
    const openAq: AirQualityProvider = {
      getAirQuality: vi
        .fn()
        .mockResolvedValue(err({ code: "rate_limited", message: "Rate limit", retryable: true })),
    };
    const openMeteo: AirQualityProvider = {
      getAirQuality: vi
        .fn()
        .mockResolvedValue(err({ code: "upstream_error", message: "500 error", retryable: true })),
    };

    const composite = new AirQualityCompositeAdapter({ openAq, openMeteo });
    const result = await composite.getAirQuality(dummyLoc);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("upstream_error");
      expect(result.error.message).toContain("All air quality providers failed");
      expect(result.error.retryable).toBe(true);
    }
  });
});
