import { describe, expect, it, vi } from "vitest";
import { OpenMeteoAdapter } from "@/adapters/open-meteo";

describe("OpenMeteoAdapter", () => {
  const dummyLoc = { lat: 28.6139, lng: 77.209, label: "New Delhi" };

  it("getAirQuality validates coordinates and rejects out-of-bounds latitude", async () => {
    const adapter = new OpenMeteoAdapter();
    const res = await adapter.getAirQuality({ lat: 105, lng: 77.2, label: "Invalid" });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("invalid_response");
      expect(res.error.message).toContain("latitude");
    }
  });

  it("getAirQuality handles hourly model data when current object is omitted", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          hourly: {
            time: ["2026-11-19T06:00", "2026-11-19T07:00"],
            pm2_5: [185.0, 192.5],
            pm10: [280.0, 300.0],
          },
        }),
    });

    const adapter = new OpenMeteoAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.getAirQuality(dummyLoc);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.pm25).toBe(185.0);
      expect(res.value.pm10).toBe(280.0);
      expect(res.value.kind).toBe("model");
      expect(res.value.source).toBe("open-meteo");
      expect(res.value.hourlyForecast.length).toBe(2);
      expect(res.value.hourlyForecast[0]?.timestamp).toBe("2026-11-19T06:00:00Z");
    }
  });

  it("getWeather parses meteorological records and clamps humidity within 0-100%", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          hourly: {
            time: ["2026-11-19T06:00"],
            temperature_2m: [15.2],
            relative_humidity_2m: [105.0], // >100 should clamp to 100
            wind_speed_10m: [2.5],
            wind_direction_10m: [180],
            precipitation: [0.0],
          },
        }),
    });

    const adapter = new OpenMeteoAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.getWeather(dummyLoc);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.hourly.length).toBe(1);
      expect(res.value.hourly[0]?.temperatureC).toBe(15.2);
      expect(res.value.hourly[0]?.humidityPercent).toBe(100);
      expect(res.value.hourly[0]?.windSpeedMs).toBe(2.5);
      expect(res.value.hourly[0]?.windDirectionDeg).toBe(180);
    }
  });
});
