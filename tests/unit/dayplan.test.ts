import { describe, expect, it } from "vitest";
import { planDay } from "@/core/dayplan";
import type { DayPlanInput } from "@/core/dayplan";
import type { HouseholdProfile } from "@/core/types";

describe("DayPlan Engine", () => {
  const baseProfile: HouseholdProfile = {
    location: { lat: 28.6139, lng: 77.209, label: "New Delhi" },
    household: { childrenAgeBands: [], hasElderly: false, hasRespiratoryCondition: false },
    commuteMode: "walk",
    home: { roomVolumeM3: 50, windowsHabit: "morning_ventilate", cookingFuel: "lpg" },
    language: "en",
  };

  const vulnerableProfile: HouseholdProfile = {
    ...baseProfile,
    household: { childrenAgeBands: ["0-2"], hasElderly: true, hasRespiratoryCondition: true },
  };

  // Generate 24 hourly forecast slots starting at 2026-11-19T00:00:00Z
  function generateForecast(startIso: string, pm25Values: number[]) {
    const start = new Date(startIso).getTime();
    return pm25Values.map((pm25, idx) => ({
      timestamp: new Date(start + idx * 3600 * 1000).toISOString(),
      pm25,
    }));
  }

  it("handles empty or missing forecast with conservative fallback", () => {
    const input: DayPlanInput = {
      now: "2026-11-19T00:00:00Z",
      timezone: "Asia/Kolkata",
      hourlyForecast: [],
      profile: baseProfile,
    };
    const plan = planDay(input);
    expect(plan.dataStatus).toBe("forecast_unavailable");
    expect(plan.slots).toHaveLength(0);
    expect(plan.bestOutdoorWindow).toBeUndefined();
    expect(plan.bestVentilationWindow).toBeUndefined();
    expect(plan.avoidWindows).toHaveLength(0);
  });

  it("identifies best outdoor and ventilation windows during lowest PM2.5 period", () => {
    // 24 hours: 10 hours at 150 (Poor), 4 hours at 25 (Good) during daytime, 10 hours at 200 (Poor)
    const pm25s = [
      ...Array(6).fill(150),
      ...Array(4).fill(25), // cleanest window
      ...Array(14).fill(180),
    ];
    const forecast = generateForecast("2026-11-19T00:00:00Z", pm25s);

    const input: DayPlanInput = {
      now: "2026-11-19T00:00:00Z",
      timezone: "UTC",
      hourlyForecast: forecast,
      profile: baseProfile,
      indoorLikely: 60, // indoor is 60; outdoor is 25 in the clean window
    };

    const plan = planDay(input);
    expect(plan.dataStatus).toBe("available");
    expect(plan.slots).toHaveLength(24);

    expect(plan.bestOutdoorWindow).toBeDefined();
    expect(plan.bestOutdoorWindow?.avgPm25).toBe(25);
    expect(plan.bestVentilationWindow).toBeDefined();
    expect(plan.bestVentilationWindow?.avgPm25).toBe(25);
  });

  it("strictly prohibits ventilation when outdoor PM2.5 exceeds indoor likely concentration", () => {
    const pm25s = Array(24).fill(100); // Outdoor 100 Moderate
    const forecast = generateForecast("2026-11-19T00:00:00Z", pm25s);

    const input: DayPlanInput = {
      now: "2026-11-19T00:00:00Z",
      timezone: "UTC",
      hourlyForecast: forecast,
      profile: baseProfile,
      indoorLikely: 40, // Indoor is cleaner than outdoor!
    };

    const plan = planDay(input);
    // Every slot should have ventilationOk: false
    expect(plan.slots.every((s) => !s.ventilationOk)).toBe(true);
    expect(plan.bestVentilationWindow).toBeUndefined();
  });

  it("never recommends outdoor activity or ventilation on Severe days", () => {
    const pm25s = Array(24).fill(320); // Severe smog (>250)
    const forecast = generateForecast("2026-11-19T00:00:00Z", pm25s);

    const input: DayPlanInput = {
      now: "2026-11-19T00:00:00Z",
      timezone: "Asia/Kolkata",
      hourlyForecast: forecast,
      profile: baseProfile,
      indoorLikely: 400, // Even if indoor was worse, severe outdoor smog forbids ventilation
    };

    const plan = planDay(input);
    expect(plan.slots.every((s) => s.outdoorActivity === "avoid")).toBe(true);
    expect(plan.slots.every((s) => !s.ventilationOk)).toBe(true);
    expect(plan.bestOutdoorWindow).toBeUndefined();
    expect(plan.bestVentilationWindow).toBeUndefined();
    expect(plan.avoidWindows.length).toBeGreaterThanOrEqual(1);
  });

  it("applies stricter outdoor activity policy for vulnerable profiles", () => {
    // 80 ug/m3 is Moderate (60-90); 110 ug/m3 is Poor (90-120)
    const pm25s = [80, 110, ...Array(22).fill(25)];
    const forecast = generateForecast("2026-11-19T00:00:00Z", pm25s);

    const generalPlan = planDay({
      now: "2026-11-19T00:00:00Z",
      timezone: "UTC",
      hourlyForecast: forecast,
      profile: baseProfile,
    });

    const vulnerablePlan = planDay({
      now: "2026-11-19T00:00:00Z",
      timezone: "UTC",
      hourlyForecast: forecast,
      profile: vulnerableProfile,
    });

    // For Moderate (80): general is 'ok', vulnerable is 'limit'
    expect(generalPlan.slots[0]!.outdoorActivity).toBe("ok");
    expect(vulnerablePlan.slots[0]!.outdoorActivity).toBe("limit");

    // For Poor (110): general is 'limit', vulnerable is 'avoid'
    expect(generalPlan.slots[1]!.outdoorActivity).toBe("limit");
    expect(vulnerablePlan.slots[1]!.outdoorActivity).toBe("avoid");
  });

  it("correctly derives local hour using IANA timezone", () => {
    // 2026-11-19T00:00:00Z is 05:30 in Asia/Kolkata -> hour 5
    const forecast = [{ timestamp: "2026-11-19T00:00:00Z", pm25: 45 }];
    const plan = planDay({
      now: "2026-11-19T00:00:00Z",
      timezone: "Asia/Kolkata",
      hourlyForecast: forecast,
      profile: baseProfile,
    });

    expect(plan.slots[0]!.hourLocal).toBe(5);
  });

  describe("Property Invariants", () => {
    it("ensures all identified windows are strictly contiguous and within the 24h horizon", () => {
      const pm25s = Array.from({ length: 24 }, (_, i) => 20 + ((i * 13) % 200));
      const forecast = generateForecast("2026-11-19T00:00:00Z", pm25s);

      const plan = planDay({
        now: "2026-11-19T00:00:00Z",
        timezone: "UTC",
        hourlyForecast: forecast,
        profile: baseProfile,
        indoorLikely: 100,
      });

      const allWindows = [
        ...(plan.bestOutdoorWindow ? [plan.bestOutdoorWindow] : []),
        ...(plan.bestVentilationWindow ? [plan.bestVentilationWindow] : []),
        ...plan.avoidWindows,
      ];

      for (const w of allWindows) {
        expect(w.durationHours).toBeGreaterThanOrEqual(1);
        expect(w.durationHours).toBeLessThanOrEqual(24);
        const startIdx = plan.slots.findIndex((s) => s.timestamp === w.startLocalIso);
        const endIdx = plan.slots.findIndex((s) => s.timestamp === w.endLocalIso);
        expect(startIdx).toBeGreaterThanOrEqual(0);
        expect(endIdx).toBeGreaterThanOrEqual(0);
        expect(endIdx - startIdx + 1).toBe(w.durationHours);
      }
    });
  });
});
