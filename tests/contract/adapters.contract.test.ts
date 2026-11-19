import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  AirQualityCompositeAdapter,
  GeocodingAdapter,
  JarvisLabsGemmaAdapter,
  OpenAqAdapter,
  OpenMeteoAdapter,
} from "@/adapters";
import type { ExplanationRequest } from "@/core/ports";

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(__dirname, "fixtures", filename), "utf-8");
}

describe("Upstream API Contract & Adapter Fixture Tests", () => {
  const dummyLoc = { lat: 28.6139, lng: 77.209, label: "New Delhi" };

  it("Open-Meteo Air Quality fixture satisfies contract and maps to AirQualitySnapshot", async () => {
    const raw = loadFixture("open-meteo-aq.json");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => raw,
    });

    const adapter = new OpenMeteoAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.getAirQuality(dummyLoc);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.source).toBe("open-meteo");
      expect(res.value.kind).toBe("model");
      expect(res.value.pm25).toBe(210.5);
      expect(res.value.pm10).toBe(340.2);
      expect(res.value.hourlyForecast.length).toBe(24);
      expect(res.value.hourlyForecast[0]?.timestamp).toBe("2026-11-19T00:00:00Z");
    }
  });

  it("Open-Meteo Weather fixture satisfies contract and maps to WeatherSnapshot", async () => {
    const raw = loadFixture("open-meteo-weather.json");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => raw,
    });

    const adapter = new OpenMeteoAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.getWeather(dummyLoc);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.hourly.length).toBe(4);
      expect(res.value.hourly[0]?.temperatureC).toBe(14.5);
      expect(res.value.hourly[0]?.windSpeedMs).toBe(1.5);
    }
  });

  it("Open-Meteo Geocoding fixture satisfies contract and resolves search query", async () => {
    const raw = loadFixture("open-meteo-geocoding.json");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => raw,
    });

    const adapter = new GeocodingAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.searchLocation("Delhi");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.length).toBe(2);
      expect(res.value[0]?.label).toContain("Delhi");
      expect(res.value[0]?.lat).toBeCloseTo(28.652, 2);
    }
  });

  it("OpenAQ v3 locations fixture satisfies contract and identifies nearest station", async () => {
    const raw = loadFixture("openaq-locations.json");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => raw,
    });

    const adapter = new OpenAqAdapter({
      apiKey: "test_key",
      fetchFn: mockFetch as unknown as typeof fetch,
      nowFn: () => new Date("2026-11-19T06:00:00Z").getTime(), // 30 mins after observation
    });

    const res = await adapter.getAirQuality(dummyLoc);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.source).toBe("openaq");
      expect(res.value.kind).toBe("measured");
      expect(res.value.pm25).toBe(248.5);
      expect(res.value.pm10).toBe(412.0);
      expect(res.value.stationDistanceKm).toBeGreaterThan(0);
    }
  });

  it("Gemma chat completion fixture satisfies contract and synthesizes valid explanation", async () => {
    const raw = loadFixture("gemma-completion.json");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => raw,
    });

    const adapter = new JarvisLabsGemmaAdapter({
      apiKey: "test_key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const request: ExplanationRequest = {
      impactResults: [
        {
          actionId: "use_hepa_purifier",
          displayMode: "numeric",
          baseline: 200,
          scenario: 40,
          deltaLow: 150,
          deltaLikely: 160,
          deltaHigh: 170,
          unit: "ug/m3 PM2.5",
          assumptions: [],
          sources: [],
          confidence: "high",
        },
        {
          actionId: "shift_outdoor_activity_to_cleaner_hour",
          displayMode: "numeric",
          baseline: 280,
          scenario: 90,
          deltaLow: 190,
          deltaLikely: 190,
          deltaHigh: 190,
          unit: "ug/m3 PM2.5",
          assumptions: [],
          sources: [],
          confidence: "high",
        },
      ],
      language: "en",
      scenarioContext: {
        commuteMode: "metro",
        windowsHabit: "morning_ventilate",
        cookingFuel: "lpg",
        locationLabel: "New Delhi",
      },
    };

    const res = await adapter.generateExplanation(request);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.narrative).toContain("severe");
      expect(res.value.actionCommentaries.length).toBe(2);
      expect(res.value.modelUsed).toBe("gemma-4-31b-it");
    }
  });

  it("AirQualityComposite combines OpenAQ measurement and Open-Meteo forecast", async () => {
    const rawAq = loadFixture("openaq-locations.json");
    const rawMeteo = loadFixture("open-meteo-aq.json");

    const mockOpenAqFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => rawAq,
    });
    const mockMeteoFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => rawMeteo,
    });

    const openAq = new OpenAqAdapter({
      apiKey: "key",
      fetchFn: mockOpenAqFetch as unknown as typeof fetch,
      nowFn: () => new Date("2026-11-19T06:00:00Z").getTime(),
    });
    const openMeteo = new OpenMeteoAdapter({
      fetchFn: mockMeteoFetch as unknown as typeof fetch,
    });

    const composite = new AirQualityCompositeAdapter({ openAq, openMeteo });
    const res = await composite.getAirQuality(dummyLoc);

    expect(res.ok).toBe(true);
    if (res.ok) {
      // Current from OpenAQ
      expect(res.value.source).toBe("openaq");
      expect(res.value.kind).toBe("measured");
      expect(res.value.pm25).toBe(248.5);
      // Forecast from Open-Meteo
      expect(res.value.hourlyForecast.length).toBe(24);
    }
  });
});
