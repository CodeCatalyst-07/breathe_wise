import { describe, expect, it } from "vitest";
import { OUTLOOK_DIFF_THRESHOLD_UG_M3 } from "@/core/heuristics";
import { forecastOutlook } from "@/core/outlook";

describe("Forecast Outlook Evaluator", () => {
  function makeForecast(h1: number, h2: number) {
    const slots = [];
    const base = new Date("2026-11-19T00:00:00Z").getTime();
    for (let i = 0; i < 12; i++) {
      slots.push({ timestamp: new Date(base + i * 3600000).toISOString(), pm25: h1 });
    }
    for (let i = 12; i < 24; i++) {
      slots.push({ timestamp: new Date(base + i * 3600000).toISOString(), pm25: h2 });
    }
    return slots;
  }

  it("returns unavailable when forecast has fewer than 12 hours", () => {
    const res = forecastOutlook([{ timestamp: "2026-11-19T00:00:00Z", pm25: 50 }]);
    expect(res.status).toBe("unavailable");
  });

  it("detects improving air quality when PM2.5 drops by more than the threshold", () => {
    // Next 12h = 200, Following 12h = 100 -> diff = 100 > 15
    const forecast = makeForecast(200, 100);
    const res = forecastOutlook(forecast, "UTC");
    expect(res.status).toBe("improving");
    expect(res.difference).toBe(100);
    expect(res.next12hAvg).toBe(200);
    expect(res.following12hAvg).toBe(100);
  });

  it("detects worsening air quality when PM2.5 rises by more than the threshold", () => {
    // Next 12h = 80, Following 12h = 150 -> diff = -70 < -15
    const forecast = makeForecast(80, 150);
    const res = forecastOutlook(forecast, "UTC");
    expect(res.status).toBe("worsening");
    expect(res.difference).toBe(-70);
  });

  it("detects stable air quality when difference is strictly within threshold boundary", () => {
    // Next 12h = 100, Following 12h = 110 -> diff = -10 (within [-15, 15])
    const forecast = makeForecast(100, 110);
    const res = forecastOutlook(forecast, "UTC");
    expect(res.status).toBe("stable");
  });

  it("tests exact threshold boundary behavior", () => {
    // Exact threshold 15.0 difference should be stable (requires > 15.0 to be improving)
    const exactForecast = makeForecast(115, 100);
    const exactRes = forecastOutlook(exactForecast, "UTC");
    expect(exactRes.difference).toBe(OUTLOOK_DIFF_THRESHOLD_UG_M3);
    expect(exactRes.status).toBe("stable");

    // Just above 15.0 difference -> improving
    const aboveForecast = makeForecast(115.1, 100);
    const aboveRes = forecastOutlook(aboveForecast, "UTC");
    expect(aboveRes.status).toBe("improving");
  });

  it("correctly identifies cleanest and worst hour extremes", () => {
    const forecast = makeForecast(150, 120);
    // Inject extreme peak and trough
    forecast[4] = { timestamp: "2026-11-19T04:00:00Z", pm25: 25 }; // cleanest
    forecast[18] = { timestamp: "2026-11-19T18:00:00Z", pm25: 350 }; // worst

    const res = forecastOutlook(forecast, "Asia/Kolkata");
    expect(res.cleanestHour?.pm25).toBe(25);
    expect(res.cleanestHour?.timestamp).toBe("2026-11-19T04:00:00Z");
    expect(res.worstHour?.pm25).toBe(350);
    expect(res.worstHour?.timestamp).toBe("2026-11-19T18:00:00Z");
  });
});
